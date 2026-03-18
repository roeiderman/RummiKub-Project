import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { logoutUser } from '../src/services/authService';
import { SessionUser, getSessionUser } from '../src/services/sessionService';

const AUTHENTICATED_ROUTES = new Set(['/home', '/edit', '/edit-board', '/edit-rack', '/solution-screen', '/leaderboard']);

export default function UserMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const shouldShow = AUTHENTICATED_ROUTES.has(pathname);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      if (!shouldShow) {
        if (isMounted) {
          setMenuVisible(false);
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      const storedUser = await getSessionUser();

      if (isMounted) {
        setUser(storedUser);
        setIsLoading(false);
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [shouldShow, pathname]);

  if (!shouldShow) {
    return null;
  }

  const displayName = user?.name?.trim() || 'Signed in';
  const displayEmail = user?.email?.trim() || 'No email available';

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logoutUser();
      setMenuVisible(false);
      router.replace('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <View pointerEvents="box-none" style={styles.anchor}>
        <TouchableOpacity
          style={styles.trigger}
          activeOpacity={0.85}
          onPress={() => setMenuVisible(true)}
        >
          <Ionicons name="person-circle-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.menuCard} onPress={() => undefined}>
            <View style={styles.menuHeader}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.userMeta}>
                <Text style={styles.userName}>{isLoading ? 'Loading...' : displayName}</Text>
                <Text style={styles.userEmail}>{isLoading ? 'Please wait' : displayEmail}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.leaderboardButton}
              activeOpacity={0.85}
              onPress={() => { setMenuVisible(false); router.push('/leaderboard'); }}
            >
              <Ionicons name="trophy-outline" size={18} color="rgb(138, 192, 133)" />
              <Text style={styles.leaderboardText}>Leaderboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
              activeOpacity={0.85}
              disabled={isLoggingOut}
              onPress={handleLogout}
            >
              {isLoggingOut ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.logoutText}>Log out</Text>
                </>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: 44,
    right: 18,
    zIndex: 100,
  },
  trigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  menuCard: {
    marginTop: 92,
    marginRight: 18,
    marginLeft: 'auto',
    width: 250,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgb(138, 192, 133)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B1B1F',
  },
  userEmail: {
    marginTop: 4,
    fontSize: 13,
    color: '#666666',
  },
  leaderboardButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgb(138, 192, 133)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  leaderboardText: {
    color: 'rgb(138, 192, 133)',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgb(50, 209, 36)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
