import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import api, { SUPPORT_PHONE } from '../../services/api';
import { useDriverSessionStore } from '../../store/useDriverSessionStore';
import { useDriverAppStore } from '../../store/useDriverAppStore';
import { colors, radius, spacing, typography } from '../../theme';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED';

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  orderId?: string | null;
  tripId?: string | null;
  messages: Array<{
    id: string;
    senderType: 'USER' | 'ADMIN' | 'SYSTEM';
    message: string;
    createdAt: string;
    senderUser?: {
      id: string;
      name: string;
      role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
    } | null;
  }>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function errorMessage(error: unknown, fallback: string) {
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : fallback;
}

export function SupportScreen() {
  const user = useDriverSessionStore((state) => state.user);
  const currentJob = useDriverAppStore((state) => state.currentJob);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [reply, setReply] = useState('');

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId),
    [selectedTicketId, tickets]
  );

  const loadTickets = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      const response = await api.get('/support/tickets', {
        params: {
          userId: user.id
        }
      });

      const next = Array.isArray(response.data) ? (response.data as SupportTicket[]) : [];
      setTickets(next);

      if (!selectedTicketId && next.length > 0) {
        setSelectedTicketId(next[0].id);
      }

      if (selectedTicketId && !next.some((ticket) => ticket.id === selectedTicketId)) {
        setSelectedTicketId(next[0]?.id);
      }
    } catch (loadError: unknown) {
      Alert.alert('Support', errorMessage(loadError, 'Could not load support tickets.'));
    } finally {
      setLoading(false);
    }
  }, [selectedTicketId, user?.id]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadTickets();
    }, 15000);

    return () => clearInterval(timer);
  }, [loadTickets]);

  const callSupport = async () => {
    const url = `tel:${SUPPORT_PHONE}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Support', `Please call ${SUPPORT_PHONE} for assistance.`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Support', `Please call ${SUPPORT_PHONE} for assistance.`);
    }
  };

  const createTicket = async () => {
    if (!user?.id || !subject.trim() || !description.trim()) {
      return;
    }

    setBusy(true);
    try {
      await api.post('/support/tickets', {
        userId: user.id,
        subject: subject.trim(),
        description: description.trim(),
        orderId: currentJob?.orderId,
        tripId: currentJob?.id
      });

      setSubject('');
      setDescription('');
      await loadTickets();
    } catch (createError: unknown) {
      Alert.alert('Support', errorMessage(createError, 'Could not create support ticket.'));
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!user?.id || !selectedTicketId || !reply.trim()) {
      return;
    }

    setBusy(true);
    try {
      await api.post(`/support/tickets/${selectedTicketId}/messages`, {
        userId: user.id,
        message: reply.trim()
      });
      setReply('');
      await loadTickets();
    } catch (replyError: unknown) {
      Alert.alert('Support', errorMessage(replyError, 'Could not send message.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Support Center</Text>
          <Text style={styles.info}>For urgent delivery issues, call support immediately.</Text>
          <Pressable style={styles.callButton} onPress={() => void callSupport()}>
            <Text style={styles.callButtonText}>Call {SUPPORT_PHONE}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Ticket</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            maxLength={140}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe issue"
            placeholderTextColor="#94A3B8"
            style={[styles.input, styles.textArea]}
            multiline
            maxLength={2000}
          />
          <Text style={styles.meta}>
            Context: Order {currentJob?.orderId ?? '--'} • Trip {currentJob?.id ?? '--'}
          </Text>
          <Pressable
            style={[styles.primaryButton, busy && styles.disabledButton]}
            onPress={() => void createTicket()}
            disabled={busy}
          >
            <Text style={styles.primaryButtonText}>{busy ? 'Submitting...' : 'Submit Ticket'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>My Tickets</Text>
          {loading ? <ActivityIndicator color={colors.secondary} style={{ marginTop: 10 }} /> : null}

          {(tickets ?? []).map((ticket) => {
            const active = ticket.id === selectedTicketId;
            return (
              <Pressable
                key={ticket.id}
                onPress={() => setSelectedTicketId(ticket.id)}
                style={[styles.ticketRow, active && styles.ticketRowActive]}
              >
                <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                <Text style={styles.ticketMeta}>
                  {ticket.status} • {formatDate(ticket.updatedAt)}
                </Text>
              </Pressable>
            );
          })}

          {!loading && tickets.length === 0 ? <Text style={styles.info}>No tickets yet.</Text> : null}
        </View>

        {selectedTicket ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ticket Thread</Text>
            <Text style={styles.meta}>Status: {selectedTicket.status}</Text>
            <View style={styles.threadWrap}>
              {selectedTicket.messages.map((message) => (
                <View key={message.id} style={styles.messageBubble}>
                  <Text style={styles.messageMeta}>
                    {message.senderType}
                    {message.senderUser?.name ? ` • ${message.senderUser.name}` : ''}
                  </Text>
                  <Text style={styles.messageText}>{message.message}</Text>
                  <Text style={styles.messageMeta}>{formatDate(message.createdAt)}</Text>
                </View>
              ))}
            </View>

            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Add follow-up message"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.textArea]}
              multiline
              maxLength={2000}
            />
            <Pressable
              style={[styles.primaryButton, busy && styles.disabledButton]}
              onPress={() => void sendReply()}
              disabled={busy}
            >
              <Text style={styles.primaryButtonText}>{busy ? 'Sending...' : 'Send Message'}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingBottom: 120
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs
  },
  title: {
    fontFamily: typography.heading,
    color: colors.accent,
    fontSize: 28
  },
  cardTitle: {
    fontFamily: typography.bodyBold,
    color: colors.accent,
    fontSize: 16
  },
  info: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 13
  },
  meta: {
    fontFamily: typography.body,
    color: '#64748B',
    fontSize: 12
  },
  callButton: {
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    alignItems: 'center'
  },
  callButtonText: {
    fontFamily: typography.bodyBold,
    color: '#F8FAFC',
    fontSize: 14
  },
  input: {
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: radius.md,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: typography.body,
    color: colors.accent,
    fontSize: 14
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  primaryButton: {
    marginTop: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    alignItems: 'center'
  },
  primaryButtonText: {
    fontFamily: typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 14
  },
  disabledButton: {
    opacity: 0.6
  },
  ticketRow: {
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radius.md,
    backgroundColor: '#FFFBEB',
    padding: spacing.sm,
    gap: 2
  },
  ticketRowActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED'
  },
  ticketSubject: {
    fontFamily: typography.bodyBold,
    color: colors.accent,
    fontSize: 14
  },
  ticketMeta: {
    fontFamily: typography.body,
    color: '#64748B',
    fontSize: 12
  },
  threadWrap: {
    gap: spacing.xs
  },
  messageBubble: {
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radius.md,
    backgroundColor: '#FFF7ED',
    padding: spacing.sm,
    gap: 4
  },
  messageMeta: {
    fontFamily: typography.body,
    color: '#64748B',
    fontSize: 11
  },
  messageText: {
    fontFamily: typography.body,
    color: colors.accent,
    fontSize: 13
  }
});
