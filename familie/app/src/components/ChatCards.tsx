import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { theme } from "../theme";
import type { ChatMessage, TravelMode } from "../types";
import { Avatar, Button, Chip, ErrorText, Input, Label, Sheet } from "./ui";
import { MODES, estimateMinutes } from "../travel";
import { getPositionOnce } from "../locationSharing";
import { formatDistance, time } from "../format";

const c = theme.colors;
const webThumb = { activeThumbColor: c.text } as object;

function useRefreshMessages() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["messages"] });
}

// ------------------------------------------------------------------ Abstimmung

export function PollCard({ message }: { message: ChatMessage }) {
  const { api, session, members, memberById } = useSession();
  const refresh = useRefreshMessages();
  const poll = message.poll!;
  const mine = poll.votes[session.member.id] ?? [];
  const voters = Object.keys(poll.votes).length;
  const counts = new Map(poll.options.map((o) => [o.id, Object.values(poll.votes).filter((v) => v.includes(o.id)).length]));
  const max = Math.max(1, ...counts.values());
  const author = memberById(message.memberId);
  const isAuthor = message.memberId === session.member.id;

  const vote = useMutation({ mutationFn: (ids: string[]) => api.vote(message.id, ids), onSettled: refresh });
  const close = useMutation({ mutationFn: () => api.closePoll(message.id), onSettled: refresh });

  const toggle = (id: string) => {
    if (poll.closed) return;
    const next = poll.multi ? (mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id]) : mine.includes(id) ? [] : [id];
    vote.mutate(next);
  };

  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>
        📊 Abstimmung · {author?.name ?? "?"}
        {poll.closed ? " · beendet" : poll.multi ? " · mehrere möglich" : ""}
      </Text>
      <Text style={s.question}>{poll.question}</Text>
      {poll.options.map((o) => {
        const n = counts.get(o.id) ?? 0;
        const chosen = mine.includes(o.id);
        const winner = poll.closed && n === max && n > 0;
        const who = Object.entries(poll.votes)
          .filter(([, v]) => v.includes(o.id))
          .map(([id]) => memberById(id));
        return (
          <Pressable
            key={o.id}
            onPress={() => toggle(o.id)}
            disabled={poll.closed}
            style={[s.option, chosen && s.optionChosen]}
            accessibilityRole={poll.multi ? "checkbox" : "radio"}
            accessibilityState={{ checked: chosen, disabled: poll.closed }}
            accessibilityLabel={`${o.text}, ${n} ${n === 1 ? "Stimme" : "Stimmen"}`}
          >
            <View style={[s.bar, { width: `${voters ? (n / max) * 100 : 0}%` }, winner && { backgroundColor: "rgba(201,168,106,0.32)" }]} />
            <Text style={[s.optionText, chosen && { color: c.goldBright, fontWeight: "700" }]} numberOfLines={2}>
              {chosen ? "✓ " : ""}
              {o.text}
              {winner ? " 🏆" : ""}
            </Text>
            <View style={s.voters}>
              {who.slice(0, 4).map((m, i) => (
                <View key={m?.id ?? i} style={{ marginLeft: i ? -6 : 0 }}>
                  <Avatar member={m} size={20} />
                </View>
              ))}
            </View>
            <Text style={s.count}>{n}</Text>
          </Pressable>
        );
      })}
      <Text style={s.meta}>
        {voters} von {members.length} haben abgestimmt · {time(message.createdAt)}
      </Text>
      <ErrorText error={vote.error ?? close.error} />
      {isAuthor && !poll.closed ? (
        <Button small variant="ghost" label="Abstimmung beenden" onPress={() => close.mutate()} loading={close.isPending} />
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ Bin gleich da

/** Sekuendlich nicht noetig – alle 20 s reicht fuer "noch 7 Min.". */
function useNow(intervalMs = 20_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function EtaCard({ message }: { message: ChatMessage }) {
  const { api, session, memberById } = useSession();
  const refresh = useRefreshMessages();
  const eta = message.eta!;
  const now = useNow();
  const who = memberById(message.memberId);
  const name = message.memberId === session.member.id ? "Du bist" : `${who?.name ?? "?"} ist`;
  const left = Math.round((new Date(eta.arriveAt).getTime() - now) / 60_000);
  const arrived = useMutation({ mutationFn: () => api.markArrived(message.id), onSettled: refresh });
  const mine = message.memberId === session.member.id;
  const dest = eta.destination === "zuhause" ? "zuhause" : eta.destination;

  let status: string;
  let tone: string = c.textMuted;
  if (eta.arrivedAt) {
    status = `✓ Angekommen um ${time(eta.arrivedAt)}`;
    tone = c.sage;
  } else if (eta.replaced) {
    status = "durch neuere Meldung ersetzt";
    tone = c.textFaint;
  } else if (left > 0) {
    status = `noch ca. ${left} Min. · Ankunft gegen ${time(eta.arriveAt)}`;
    tone = c.goldBright;
  } else if (left > -15) {
    status = "müsste gleich da sein …";
    tone = c.goldBright;
  } else {
    status = `geplant für ${time(eta.arriveAt)} – noch nicht gemeldet`;
    tone = c.danger;
  }

  return (
    <View style={[s.card, eta.arrivedAt ? { borderColor: "rgba(143,191,159,0.35)" } : null]}>
      <View style={s.etaRow}>
        <Text style={s.etaIcon}>{eta.arrivedAt ? "🏠" : MODES[eta.mode].icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.question}>{eta.arrivedAt ? `${name} ${dest} angekommen` : `${name} in ca. ${eta.minutes} Min. ${dest}`}</Text>
          <Text style={[s.meta, { color: tone, marginTop: 2 }]}>{status}</Text>
        </View>
      </View>
      {mine && !eta.arrivedAt && !eta.replaced ? (
        <Button small label="🏠 Bin angekommen" onPress={() => arrived.mutate()} loading={arrived.isPending} />
      ) : null}
      <ErrorText error={arrived.error} />
    </View>
  );
}

// ------------------------------------------------------------------ Eingabe-Fenster

export function ChatActions({ onPoll, onEta, onClose }: { onPoll: () => void; onEta: () => void; onClose: () => void }) {
  return (
    <Sheet eyebrow="Im Chat teilen" onClose={onClose}>
      <Pressable style={s.action} onPress={onEta} accessibilityRole="button">
        <Text style={s.actionIcon}>🏠</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.question}>Bin gleich da</Text>
          <Text style={s.meta}>Ankunftszeit schätzen und der Familie Bescheid geben</Text>
        </View>
      </Pressable>
      <Pressable style={s.action} onPress={onPoll} accessibilityRole="button">
        <Text style={s.actionIcon}>📊</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.question}>Abstimmung</Text>
          <Text style={s.meta}>„Wohin am Wochenende?“ – alle stimmen ab</Text>
        </View>
      </Pressable>
      <Button variant="ghost" label="Abbrechen" onPress={onClose} />
    </Sheet>
  );
}

export function PollComposer({ onClose }: { onClose: () => void }) {
  const { api } = useSession();
  const refresh = useRefreshMessages();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multi, setMulti] = useState(false);
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const create = useMutation({
    mutationFn: () => api.createPoll(question.trim(), filled, multi),
    onSuccess: () => {
      void refresh();
      onClose();
    },
  });
  const setOption = (i: number, v: string) => {
    const next = options.map((o, j) => (j === i ? v : o));
    // Automatisch ein neues leeres Feld anbieten, solange < 8
    if (i === next.length - 1 && v.trim() && next.length < 8) next.push("");
    setOptions(next);
  };
  return (
    <Sheet eyebrow="Neue Abstimmung" onClose={onClose}>
      <Input label="Frage" value={question} onChangeText={setQuestion} placeholder="z. B. Wohin am Sonntag?" maxLength={200} autoFocus />
      <Label>Antworten</Label>
      {options.map((o, i) => (
        <Input
          key={i}
          value={o}
          onChangeText={(v) => setOption(i, v)}
          placeholder={["Zoo", "Schwimmbad", "Wald", "Zuhause bleiben"][i] ?? `Antwort ${i + 1}`}
          maxLength={80}
        />
      ))}
      <View style={s.switchRow}>
        <Text style={[s.question, { flex: 1, fontSize: 15 }]}>Mehrere Antworten erlauben</Text>
        <Switch value={multi} onValueChange={setMulti} trackColor={{ true: c.gold, false: c.surface3 }} thumbColor={c.text} {...webThumb} />
      </View>
      <ErrorText error={create.error} />
      <Button
        label="Abstimmung starten"
        onPress={() => create.mutate()}
        disabled={!question.trim() || filled.length < 2}
        loading={create.isPending}
      />
      <Button variant="ghost" label="Abbrechen" onPress={onClose} />
    </Sheet>
  );
}

export function EtaComposer({ onClose, onNeedHome }: { onClose: () => void; onNeedHome: () => void }) {
  const { api, session } = useSession();
  const refresh = useRefreshMessages();
  const home = session.family.home;
  const [mode, setMode] = useState<TravelMode>("car");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posError, setPosError] = useState<string | null>(null);
  const [manual, setManual] = useState<number | null>(null);

  useEffect(() => {
    if (!home) return;
    getPositionOnce().then(setPos, (e) => setPosError(e instanceof Error ? e.message : String(e)));
  }, [home]);

  const estimate = home && pos ? estimateMinutes(pos, home, mode) : null;
  const minutes = manual ?? estimate?.minutes ?? null;
  const send = useMutation({
    mutationFn: () => api.sendEta(mode, minutes!, "zuhause"),
    onSuccess: () => {
      void refresh();
      onClose();
    },
  });

  return (
    <Sheet eyebrow="Bin gleich da" title="Wann bist du zuhause?" onClose={onClose}>
      <View style={s.chips}>
        {(Object.keys(MODES) as TravelMode[]).map((m) => (
          <Chip key={m} label={`${MODES[m].icon} ${MODES[m].label}`} active={mode === m} onPress={() => setMode(m)} />
        ))}
      </View>
      {!home ? (
        <View style={{ gap: 8 }}>
          <Text style={s.meta}>
            Damit die App die Fahrzeit schätzen und deine Ankunft erkennen kann, speichert ihr einmal, wo „Zuhause“ ist.
          </Text>
          <Button small variant="ghost" label="Zuhause festlegen" onPress={onNeedHome} />
        </View>
      ) : estimate ? (
        <Text style={s.estimate}>
          ca. {estimate.minutes} Min. · {formatDistance(estimate.km)} Luftlinie
        </Text>
      ) : (
        <Text style={s.meta}>{posError ?? "Standort wird ermittelt …"}</Text>
      )}
      <Label>{estimate ? "Oder selbst wählen" : "Wie lange noch?"}</Label>
      <View style={s.chips}>
        {[5, 10, 15, 20, 30, 45, 60].map((n) => (
          <Chip key={n} label={`${n} Min.`} active={manual === n} onPress={() => setManual(manual === n ? null : n)} />
        ))}
      </View>
      {home ? <Text style={s.hint}>Wenn du deinen Standort teilst, meldet die App automatisch, sobald du zuhause bist.</Text> : null}
      <ErrorText error={send.error} />
      <Button
        label={minutes ? `Senden: in ca. ${minutes} Min. zuhause` : "Zeit wählen"}
        onPress={() => send.mutate()}
        disabled={!minutes}
        loading={send.isPending}
      />
      <Button variant="ghost" label="Abbrechen" onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.goldDim,
    padding: theme.spacing(3.5),
    gap: theme.spacing(2),
    width: "100%",
    maxWidth: 420,
  },
  eyebrow: { color: c.gold, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  question: { color: c.text, fontSize: 16, fontWeight: "600" },
  option: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.hairline,
    backgroundColor: c.surface2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  optionChosen: { borderColor: c.gold },
  bar: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: c.goldDim },
  optionText: { flex: 1, color: c.text, fontSize: 15 },
  voters: { flexDirection: "row" },
  count: { color: c.textMuted, fontWeight: "700", minWidth: 16, textAlign: "right" },
  meta: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  etaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3) },
  etaIcon: { fontSize: 30 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(3.5),
    backgroundColor: c.surface2,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: theme.spacing(4),
  },
  actionIcon: { fontSize: 28 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3) },
  estimate: { color: c.goldBright, fontSize: 22, fontWeight: "700" },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 17 },
});
