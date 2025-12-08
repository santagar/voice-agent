"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceMessage } from "@/lib/realtime/useRealtimeSession";

type UseChatScrollingParams = {
  chatRef: React.RefObject<HTMLDivElement | null>;
  messages: VoiceMessage[];
  visibleMessages: VoiceMessage[];
  hasTypedInput: boolean;
  input: string;
};

export function useChatScrolling({
  chatRef,
  messages,
  visibleMessages,
  hasTypedInput,
  input,
}: UseChatScrollingParams) {
  const [showScrollDown, setShowScrollDown] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on new messages.
  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, chatRef]);

  // Track whether the scroll-down button should appear.
  useEffect(() => {
    const chatEl = chatRef.current;
    if (!chatEl) return;
    const updateScroll = () => {
      const canScroll = chatEl.scrollHeight > chatEl.clientHeight;
      const nearBottom =
        chatEl.scrollHeight - (chatEl.scrollTop + chatEl.clientHeight) < 8;
      setShowScrollDown(canScroll && !nearBottom);
    };
    updateScroll();
    chatEl.addEventListener("scroll", updateScroll);
    return () => {
      chatEl.removeEventListener("scroll", updateScroll);
    };
  }, [chatRef]);

  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatRef]);

  // Nudge to bottom when typing.
  useEffect(() => {
    scrollToBottom();
  }, [input, scrollToBottom]);

  // Keep the tail of the conversation in view when new messages arrive or user types.
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [visibleMessages, hasTypedInput]);

  return { showScrollDown, setShowScrollDown, scrollToBottom, endRef };
}
