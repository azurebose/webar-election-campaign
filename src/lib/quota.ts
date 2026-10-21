import { doc, getDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Retrieve or generate a persistent visitor fingerprint stored in localStorage
 */
export function getVisitorFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'server-instance';
  }

  let fingerprint = localStorage.getItem('ar_visitor_fingerprint');
  if (!fingerprint) {
    // Generate a secure pseudo-random fingerprint with timestamp and device parameters
    const randomSeed = Math.random().toString(36).substring(2, 15);
    const screenInfo = `${window.screen.width}x${window.screen.height}`;
    fingerprint = `fp_${Date.now()}_${randomSeed}_${screenInfo}`;
    localStorage.setItem('ar_visitor_fingerprint', fingerprint);
  }
  return fingerprint;
}

/**
 * Verify and increment scan allowance in Firestore.
 * 
 * Rules:
 * - If auth.currentUser is authenticated: immediately return true (unlimited scans).
 * - Otherwise, inspect `/visitor_sessions/{fingerprint}`.
 * - If scan_count >= 2: return false (quota exceeded).
 * - Otherwise: atomically increment scan_count by 1 and return true.
 */
export async function verifyAndIncrementScan(fingerprint: string): Promise<boolean> {
  // 1. Authenticated voters have unlimited scans
  if (auth.currentUser) {
    return true;
  }

  // Check localStorage auth fallback for instant responsiveness
  if (typeof window !== 'undefined' && localStorage.getItem('auth_email')) {
    return true;
  }

  try {
    const sessionDocRef = doc(db, 'visitor_sessions', fingerprint);
    const sessionSnap = await getDoc(sessionDocRef);

    if (sessionSnap.exists()) {
      const data = sessionSnap.data();
      const currentScans = data?.scan_count ?? 0;

      if (currentScans >= 2) {
        return false;
      }
    }

    // Atomically increment scan count and record last scan timestamp
    await setDoc(
      sessionDocRef,
      {
        scan_count: increment(1),
        lastScannedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.warn('[Quota] Firestore session check failed, falling back to local storage enforcement:', error);

    // Fallback quota check if Firestore network request fails (e.g. offline or unconfigured keys)
    if (typeof window !== 'undefined') {
      const localScans = parseInt(localStorage.getItem('ar_scan_count') || '0', 10);
      if (localScans >= 2) {
        return false;
      }
      localStorage.setItem('ar_scan_count', (localScans + 1).toString());
      return true;
    }

    return true;
  }
}

/**
 * Record voter pledge in Firestore voter_profiles/{uid}
 */
export async function recordVotePledge(uid?: string, email?: string): Promise<void> {
  const currentUid = uid || auth.currentUser?.uid;
  const currentEmail = email || auth.currentUser?.email || (typeof window !== 'undefined' ? localStorage.getItem('auth_email') : null);

  if (currentUid) {
    try {
      const voterDocRef = doc(db, 'voter_profiles', currentUid);
      await setDoc(
        voterDocRef,
        {
          email: currentEmail || '',
          pledged_to_vote: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[Pledge] Failed to sync pledge to Firestore voter profile:', err);
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('voter_pledged', 'true');
  }
}
