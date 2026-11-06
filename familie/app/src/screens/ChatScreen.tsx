import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { theme } from "../theme";
import type { ChatMessage } from "../types";
import { Avatar, Button, Empty, ErrorText, ScreenHeader } from "../components/ui";
import { dayKey, longDate, time } from "../format";

const c = theme.colors;

export function ChatScreen() {
  const { api, session, memberById, live } = useSession();
  const qc = useQueryClient();
  const messages = useQuery({ queryKey: ["messages"], queryFn: api.messages });
  const [text, setText] = useState("");
  const list = useRef<FlatList<ChatMessage>>(null);

  const send = useMutation({
    mutationFn: (t: string) => api.sendMessage(t),
    onSuccess: (msg) => qc.setQueryData<ChatMessage[]>(["messages"], (old: ChatMessage[] | undefined) => (old?.some((m: ChatMessage) => m.id === msg.id) ? old : [...(old ?? []), msg])),
    onError: (_e, t) => setText(t),
  });

  const data = messages.data ?? [];
  useEffect(() => {
    const t = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [data.length]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    send.mutate(t);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}>
      <ScreenHeader eyebrow={live ? "● Live" : "○ Verbinde …"} title={session.family.name} />
      <ErrorText error={messages.error ?? send.error} />
      <FlatList
        ref={list}
        data={data}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(3), flexGrow: 1 }}
        ListEmptyComponent={<Empty icon="✉" title="Noch keine Nachrichten" text="Schreib der Familie die erste Nachricht." />}
        renderItem={({ item, index }) => {
          const prev = data[index - 1];
          const mine = item.memberId === session.member.id;
          const author = memberById(item.memberId);
          const newDay = !prev || dayKey(new Date(prev.createdAt)) !== dayKey(new Date(item.createdAt));
          const grouped = !newDay && prev?.memberId === item.memberId;
          return (
            <View>
              {newDay ? <Text style={s.day}>{longDate(new Date(item.createdAt))}</Text> : null}
              <View style={[s.row, mine && { justifyContent: "flex-end" }, grouped && { marginTop: 2 }]}>
                {!mine ? <View style={{ width: 30 }}>{!grouped ? <Avatar member={author} size={28} /> : null}</View> : null}
                <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                  {!mine && !grouped ? <Text style={[s.author, { color: author?.color ?? c.textMuted }]}>{author?.name ?? "Ehemaliges Mitglied"}</Text> : null}
                  <Text style={[s.text, mine && { color: c.onGold }]}>{item.text}</Text>
                  <Text style={[s.time, mine && { color: "rgba(23,20,12,0.6)" }]}>{time(item.createdAt)}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />
      <View style={s.bar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Nachricht …"
          placeholderTextColor={c.textFaint}
          selectionColor={c.gold}
          style={s.input}
          multiline
          maxLength={2000}
          onSubmitEditing={submit}
          blurOnSubmit={false}
          returnKeyType="send"
        />
        <Button label="Senden" onPress={submit} disabled={!text.trim()} loading={send.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  day: { color: c.textFaint, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", textAlign: "center", marginVertical: theme.spacing(4) },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: theme.spacing(2.5) },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  mine: { backgroundColor: c.gold, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.hairline, borderBottomLeftRadius: 6 },
  author: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  text: { color: c.text, fontSize: 16, lineHeight: 21 },
  time: { color: c.textFaint, fontSize: 10, alignSelf: "flex-end", marginTop: 2 },
  bar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: theme.spacing(3), borderTopWidth: 1, borderTopColor: c.hairline },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: c.surface2,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.hairline,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
    color: c.text,
    fontSize: 16,
  },
});
