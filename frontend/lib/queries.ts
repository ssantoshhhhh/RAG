"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { ApiError, api } from "@/lib/api";
import type {
  ChatResponse,
  Conversation,
  ConversationDetail,
  DashboardStats,
  DocumentItem,
  DocumentPreview,
  HealthStatus,
  User,
} from "@/lib/types";
import { isActiveStatus } from "@/lib/utils";

export const queryKeys = {
  me: ["me"] as const,
  stats: ["dashboard", "stats"] as const,
  documents: (search: string, status: string) => ["documents", { search, status }] as const,
  document: (id: string) => ["documents", id] as const,
  preview: (id: string) => ["documents", id, "preview"] as const,
  conversations: ["conversations"] as const,
  conversation: (id: string) => ["conversations", id] as const,
  health: ["health"] as const,
};

function refreshActiveStatuses(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["documents"] });
  void client.invalidateQueries({ queryKey: queryKeys.stats });
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get<User>("/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: { email: string; password: string }) =>
      api.post<User>("/auth/login", values),
    onSuccess: (user) => {
      client.setQueryData(queryKeys.me, user);
    },
  });
}

export function useRegister() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: { name: string; email: string; password: string }) =>
      api.post<User>("/auth/register", values),
    onSuccess: (user) => {
      client.setQueryData(queryKeys.me, user);
    },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/auth/logout"),
    onSettled: () => {
      client.clear();
    },
  });
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => api.get<DashboardStats>("/dashboard/stats"),
  });
}

export function useDocuments(search = "", status = "") {
  return useQuery({
    queryKey: queryKeys.documents(search, status),
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      params.set("limit", "200");
      return api.get<DocumentItem[]>(`/documents?${params.toString()}`);
    },
    refetchInterval: (query) => {
      const documents = query.state.data;
      return documents?.some((document) => isActiveStatus(document.status)) ? 2500 : false;
    },
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.document(id ?? ""),
    queryFn: () => api.get<DocumentItem>(`/documents/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const document = query.state.data;
      return document && isActiveStatus(document.status) ? 2000 : false;
    },
  });
}

export function useDocumentPreview(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.preview(id ?? ""),
    queryFn: () => api.get<DocumentPreview>(`/documents/${id}/preview`),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export function useDeleteDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => refreshActiveStatuses(client),
  });
}

export function useRetryDocument() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<DocumentItem>(`/documents/${id}/retry`),
    onSuccess: (document) => {
      client.setQueryData(queryKeys.document(document.id), document);
      refreshActiveStatuses(client);
    },
  });
}

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => api.get<Conversation[]>("/conversations"),
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.conversation(id ?? ""),
    queryFn: () => api.get<ConversationDetail>(`/conversations/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title?: string; document_ids?: string[] | null } = {}) =>
      api.post<Conversation>("/conversations", payload),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.conversations }),
  });
}

export function useRenameConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch<Conversation>(`/conversations/${id}`, { title }),
    onSuccess: (conversation) => {
      client.setQueryData<ConversationDetail>(
        queryKeys.conversation(conversation.id),
        (current) => (current ? { ...current, ...conversation } : current),
      );
      void client.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export function useDeleteConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/conversations/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.conversations }),
  });
}

export function useAsk() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      question: string;
      conversation_id?: string;
      document_ids?: string[];
    }) => api.post<ChatResponse>("/chat/ask", payload),
    onSuccess: (response) => {
      const existing = client.getQueryData<ConversationDetail>(
        queryKeys.conversation(response.conversation.id),
      );
      client.setQueryData<ConversationDetail>(
        queryKeys.conversation(response.conversation.id),
        existing
          ? {
              ...existing,
              ...response.conversation,
              messages: [
                ...existing.messages.filter(
                  (message) => message.id !== response.user_message.id,
                ),
                response.user_message,
                response.assistant_message,
              ],
            }
          : {
              ...response.conversation,
              messages: [response.user_message, response.assistant_message],
            },
      );
      void client.invalidateQueries({ queryKey: queryKeys.conversations });
      void client.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: async (): Promise<HealthStatus> => {
      const response = await fetch("/api/v1/health", {
        credentials: "include",
        cache: "no-store",
      });
      try {
        return (await response.json()) as HealthStatus;
      } catch {
        throw new ApiError("The backend health check returned an unexpected response.", response.status);
      }
    },
    retry: false,
    refetchInterval: 30_000,
  });
}