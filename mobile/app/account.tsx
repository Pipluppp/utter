import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiJson } from '../lib/api';
import { hapticError, hapticLight, hapticSubmit, hapticSuccess } from '../lib/haptics';
import type { CreditsUsageResponse, MeResponse } from '../lib/types';
import { useAuth } from '../providers/AuthProvider';

// ---------------------------------------------------------------------------
// Credit packs — mirrors frontend/src/content/plans.ts
// ---------------------------------------------------------------------------
const CREDIT_PACKS = [
  { id: 'pack_30k' as const, name: 'Starter', priceUsd: 2.99, credits: 30_000, blurb: 'About 80 min of audio' },
  { id: 'pack_120k' as const, name: 'Studio', priceUsd: 9.99, credits: 120_000, blurb: 'About 320 min of audio', featured: true },
];

function formatCredits(n: number) {
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
      {title}
    </Text>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={{ backgroundColor: '#111', borderRadius: 10, borderCurve: 'continuous', padding: 16, ...style }}>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#222', marginVertical: 20 }} />;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AccountScreen() {
  const { signOut, user } = useAuth();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [credits, setCredits] = useState<CreditsUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile editing
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Checkout
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  // Rate card
  const [rateCardExpanded, setRateCardExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [meData, creditsData] = await Promise.all([
        apiJson<MeResponse>('/api/me'),
        apiJson<CreditsUsageResponse>('/api/credits/usage?window_days=90'),
      ]);
      setMe(meData);
      setCredits(creditsData);
      setDisplayName(meData.profile?.display_name ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load account data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  // ---- Checkout ----
  const startCheckout = useCallback(async (packId: string) => {
    setCheckingOut(packId);
    void hapticSubmit();
    try {
      const { url } = await apiJson<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        json: { pack_id: packId },
      });
      await WebBrowser.openBrowserAsync(url);
      // Refresh after returning from browser
      void fetchData();
    } catch (e) {
      void hapticError();
      Alert.alert('Checkout Error', e instanceof Error ? e.message : 'Failed to start checkout');
    } finally {
      setCheckingOut(null);
    }
  }, [fetchData]);

  // ---- Save profile ----
  const saveProfile = useCallback(async () => {
    setSavingProfile(true);
    void hapticSubmit();
    try {
      await apiJson('/api/profile', {
        method: 'POST',
        json: { display_name: displayName.trim() },
      });
      void hapticSuccess();
      // Refresh to get updated profile
      void fetchData();
    } catch (e) {
      void hapticError();
      Alert.alert('Save Error', e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  }, [displayName, fetchData]);

  // ---- Sign out ----
  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }, [signOut]);

  // ---- Copy user ID ----
  const copyUserId = useCallback(() => {
    if (!me?.profile?.id) return;
    Clipboard.setString(me.profile.id);
    void hapticLight();
    Alert.alert('Copied', 'User ID copied to clipboard');
  }, [me?.profile?.id]);

  // ---- Loading state ----
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
        {/* Credits section skeleton */}
        <View style={{ backgroundColor: '#1a1a1a', height: 12, width: 70, borderRadius: 4, marginBottom: 10 }} />
        <View style={{ backgroundColor: '#111', borderRadius: 10, borderCurve: 'continuous', padding: 16 }}>
          <View style={{ backgroundColor: '#222', height: 48, width: 140, borderRadius: 4 }} />
          <View style={{ backgroundColor: '#1a1a1a', height: 14, width: '70%', borderRadius: 4, marginTop: 10 }} />
        </View>
        {/* Trials section skeleton */}
        <View style={{ height: 1, backgroundColor: '#222', marginVertical: 20 }} />
        <View style={{ backgroundColor: '#1a1a1a', height: 12, width: 80, borderRadius: 4, marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: '#111', borderRadius: 10, borderCurve: 'continuous', height: 90 }} />
          <View style={{ flex: 1, backgroundColor: '#111', borderRadius: 10, borderCurve: 'continuous', height: 90 }} />
        </View>
        {/* Buy credits skeleton */}
        <View style={{ height: 1, backgroundColor: '#222', marginVertical: 20 }} />
        <View style={{ backgroundColor: '#1a1a1a', height: 12, width: 90, borderRadius: 4, marginBottom: 10 }} />
        <View style={{ backgroundColor: '#111', borderRadius: 10, borderCurve: 'continuous', height: 80, marginBottom: 10 }} />
        <View style={{ backgroundColor: '#111', borderRadius: 10, borderCurve: 'continuous', height: 80 }} />
      </View>
    );
  }

  const hasProfileChange = displayName.trim() !== (me?.profile?.display_name ?? '');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#000' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      {error && (
        <Text selectable style={{ color: '#f44', fontSize: 14, padding: 12, backgroundColor: '#1a0000', borderRadius: 8, borderCurve: 'continuous', marginBottom: 16 }}>
          {error}
        </Text>
      )}

      {/* ---- Credit Balance ---- */}
      {credits && (
        <>
          <SectionHeader title="Credits" />
          <Card>
            <Text style={{ color: '#fff', fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {formatCredits(credits.balance)}
            </Text>
            <Text style={{ color: '#888', fontSize: 14, marginTop: 6 }}>
              {formatCredits(credits.usage.debited)} credits used in the past {credits.window_days} days
            </Text>
          </Card>
        </>
      )}

      {/* ---- Trial Counters ---- */}
      {credits && (
        <>
          <Divider />
          <SectionHeader title="Free trials" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Card style={{ flex: 1 }}>
              <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                Design
              </Text>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] }}>
                {credits.trials.design_remaining}
              </Text>
              <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>previews left</Text>
            </Card>
            <Card style={{ flex: 1 }}>
              <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                Clone
              </Text>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] }}>
                {credits.trials.clone_remaining}
              </Text>
              <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>finalizations left</Text>
            </Card>
          </View>
        </>
      )}

      {/* ---- Buy Credits ---- */}
      <>
        <Divider />
        <SectionHeader title="Buy credits" />
        <View style={{ gap: 10 }}>
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.id} style={pack.featured ? { borderWidth: 1, borderColor: '#333' } : undefined}>
              {pack.featured && (
                <View style={{ position: 'absolute', top: -10, left: 12, backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#333', borderRadius: 4, borderCurve: 'continuous' }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Best value</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{pack.name}</Text>
                  <Text style={{ color: '#888', fontSize: 14, marginTop: 4 }}>
                    ${pack.priceUsd.toFixed(2)} · {formatCredits(pack.credits)} credits
                  </Text>
                  <Text style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{pack.blurb}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => void startCheckout(pack.id)}
                  disabled={checkingOut !== null}
                  style={{
                    backgroundColor: checkingOut === pack.id ? '#444' : '#fff',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                    borderCurve: 'continuous',
                    opacity: checkingOut !== null && checkingOut !== pack.id ? 0.4 : 1,
                  }}
                >
                  {checkingOut === pack.id ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={{ color: '#000', fontSize: 14, fontWeight: '600' }}>Buy</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      </>

      {/* ---- Recent Activity ---- */}
      {credits && credits.events.length > 0 && (
        <>
          <Divider />
          <SectionHeader title="Recent activity" />
          <View style={{ gap: 8 }}>
            {credits.events.slice(0, 10).map((ev) => {
              const isCredit = ev.signed_amount > 0;
              const ts = new Date(ev.created_at);
              const dateStr = `${ts.getMonth() + 1}/${ts.getDate()} ${ts.getHours()}:${String(ts.getMinutes()).padStart(2, '0')}`;
              return (
                <Card key={ev.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: '#ccc', fontSize: 14, fontWeight: '500' }}>{ev.operation}</Text>
                      <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                        Balance: {formatCredits(ev.balance_after)} · {dateStr}
                      </Text>
                    </View>
                    <Text style={{
                      color: isCredit ? '#4c6' : '#f66',
                      fontSize: 15,
                      fontWeight: '600',
                      fontVariant: ['tabular-nums'],
                    }}>
                      {isCredit ? '+' : ''}{formatCredits(ev.signed_amount)}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>
        </>
      )}

      {/* ---- Rate Card ---- */}
      {credits && credits.rate_card.length > 0 && (
        <>
          <Divider />
          <TouchableOpacity onPress={() => setRateCardExpanded(!rateCardExpanded)} activeOpacity={0.7}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionHeader title="Pricing" />
              <Text style={{ color: '#666', fontSize: 13, marginBottom: 10 }}>
                {rateCardExpanded ? '▲' : '▼'}
              </Text>
            </View>
          </TouchableOpacity>
          {rateCardExpanded && (
            <View style={{ gap: 8 }}>
              {credits.rate_card.map((item) => (
                <Card key={item.action}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: '#ccc', fontSize: 14, fontWeight: '500' }}>{item.action}</Text>
                      <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>{item.note}</Text>
                    </View>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{item.cost}</Text>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </>
      )}

      {/* ---- Profile ---- */}
      <>
        <Divider />
        <SectionHeader title="Profile" />
        <Card>
          <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Display name
          </Text>
          <TextInput
            style={{
              backgroundColor: '#1a1a1a',
              color: '#fff',
              borderRadius: 8,
              borderCurve: 'continuous',
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              borderWidth: 1,
              borderColor: '#333',
            }}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#666"
            autoCorrect={false}
            editable={!savingProfile}
          />
          <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>
            Email
          </Text>
          <Text style={{ color: '#999', fontSize: 15 }}>{user?.email ?? 'Unknown'}</Text>

          <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>
            User ID
          </Text>
          <TouchableOpacity onPress={copyUserId} activeOpacity={0.7}>
            <Text style={{ color: '#666', fontSize: 13 }}>{me?.profile?.id ?? '—'}</Text>
          </TouchableOpacity>

          {hasProfileChange && (
            <TouchableOpacity
              onPress={() => void saveProfile()}
              disabled={savingProfile}
              style={{
                backgroundColor: '#fff',
                marginTop: 16,
                paddingVertical: 10,
                borderRadius: 8,
                borderCurve: 'continuous',
                alignItems: 'center',
                opacity: savingProfile ? 0.6 : 1,
              }}
            >
              {savingProfile ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={{ color: '#000', fontSize: 15, fontWeight: '600' }}>Save</Text>
              )}
            </TouchableOpacity>
          )}
        </Card>
      </>

      {/* ---- Sign Out ---- */}
      <>
        <Divider />
        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            backgroundColor: '#1a0000',
            paddingVertical: 14,
            borderRadius: 10,
            borderCurve: 'continuous',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#331111',
          }}
        >
          <Text style={{ color: '#f66', fontSize: 15, fontWeight: '600' }}>Sign Out</Text>
        </TouchableOpacity>
      </>
    </ScrollView>
  );
}
