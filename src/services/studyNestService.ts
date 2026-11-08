import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  Assignment,
  ClassInvitation,
  ClassMember,
  ClassRole,
  ClassThemeColor,
  ClassThemeIcon,
  InstructorReviewStatus,
  InvitationSecret,
  JoinRequest,
  LearningRecord,
  Lesson,
  LessonKeyword,
  LessonNote,
  LessonStatus,
  QuizQuestion,
  ScheduleException,
  ScheduleItem,
  SessionChecklistItem,
  SrsCardProgress,
  StudyClass,
  StudySession,
  StudySessionStatus,
  SupportedTtsLang,
  UserProfile,
} from '@/types/domain';
import { getFirebaseServices, isFirebaseConfigured } from '@/lib/firebase';
import {
  computeInvitationCodeHash,
  decodeCompositeInviteToken,
  encodeCompositeInviteToken,
  generateJoinCode,
  generateRandomToken,
  normalizeJoinCode,
} from '@/lib/crypto';
import { DEFAULT_CLASS_TIMEZONE } from '@/lib/date';
import { loadDemoState, saveDemoState } from './demoStore';

export async function ensureUserProfile(user: {
  uid: string;
  displayName: string;
  photoURL: string;
}): Promise<UserProfile> {
  const now = Timestamp.now();
  const profile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || 'Người dùng StudyNest',
    photoURL: user.photoURL || '',
    createdAt: now,
    updatedAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const existing = state.users[user.uid];
    const merged: UserProfile = existing
      ? {
          ...existing,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          updatedAt: now,
        }
      : profile;
    state.users[user.uid] = merged;
    saveDemoState(state);
    return merged;
  }

  const { db } = getFirebaseServices();
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const existing = snap.data() as UserProfile;
    const updated: UserProfile = {
      uid: user.uid,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      createdAt: existing.createdAt || now,
      updatedAt: now,
    };
    await setDoc(userRef, updated);
    return updated;
  }
  await setDoc(userRef, profile);
  return profile;
}

export async function listUserClassesWithMembership(
  uid: string
): Promise<Array<{ studyClass: StudyClass; membership: ClassMember }>> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const results: Array<{ studyClass: StudyClass; membership: ClassMember }> = [];
    for (const [classId, membersByUid] of Object.entries(state.members)) {
      const m = membersByUid[uid];
      const cls = state.classes[classId];
      if (m && m.status === 'active' && cls) {
        results.push({ studyClass: cls, membership: m });
      }
    }
    return results;
  }

  const { db } = getFirebaseServices();
  const membersQuery = query(
    collectionGroup(db, 'members'),
    where('uid', '==', uid)
  );
  const memberSnaps = await getDocs(membersQuery);
  const results: Array<{ studyClass: StudyClass; membership: ClassMember }> = [];

  for (const mDoc of memberSnaps.docs) {
    const membership = mDoc.data() as ClassMember;
    if (membership.status !== 'active') continue;
    const classSnap = await getDoc(doc(db, 'classes', membership.classId));
    if (classSnap.exists()) {
      results.push({
        studyClass: classSnap.data() as StudyClass,
        membership,
      });
    }
  }
  return results;
}

export async function getClassContext(
  classId: string,
  uid: string
): Promise<{ studyClass: StudyClass; membership: ClassMember } | null> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const studyClass = state.classes[classId];
    const membership = state.members[classId]?.[uid];
    if (!studyClass || !membership || membership.status !== 'active') {
      return null;
    }
    return { studyClass, membership };
  }

  const { db } = getFirebaseServices();
  const memberSnap = await getDoc(doc(db, 'classes', classId, 'members', uid));
  if (!memberSnap.exists()) return null;
  const membership = memberSnap.data() as ClassMember;
  if (membership.status !== 'active') return null;

  const classSnap = await getDoc(doc(db, 'classes', classId));
  if (!classSnap.exists()) return null;
  return {
    studyClass: classSnap.data() as StudyClass,
    membership,
  };
}

export async function createClassWithOwnerAtomic(
  uid: string,
  displayName: string,
  avatarUrl: string,
  input: {
    name: string;
    description: string;
    color: ClassThemeColor;
    icon: ClassThemeIcon;
    timezone?: string;
    studyDaysOfWeek: number[];
  }
): Promise<StudyClass> {
  const now = Timestamp.now();
  const classId = `cls_${generateRandomToken(12)}`;
  const studyClass: StudyClass = {
    id: classId,
    name: input.name.trim(),
    description: input.description.trim(),
    color: input.color,
    icon: input.icon,
    timezone: input.timezone || DEFAULT_CLASS_TIMEZONE,
    studyDaysOfWeek: input.studyDaysOfWeek,
    ownerId: uid,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  };

  const ownerMember: ClassMember = {
    uid,
    classId,
    role: 'owner',
    status: 'active',
    displayName: displayName || 'Chủ lớp',
    avatarUrl: avatarUrl || '',
    joinedAt: now,
    updatedAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    state.classes[classId] = studyClass;
    state.members[classId] = { [uid]: ownerMember };
    state.invitations[classId] = {};
    state.invitationSecrets[classId] = {};
    state.joinRequests[classId] = {};
    state.schedules[classId] = {};
    state.scheduleExceptions[classId] = {};
    state.lessons[classId] = {};
    state.lessonNotes[classId] = {};
    state.sessions[classId] = {};
    state.assignments[classId] = {};
    state.learningRecords[classId] = {};
    saveDemoState(state);
    return studyClass;
  }

  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  batch.set(doc(db, 'classes', classId), studyClass);
  batch.set(doc(db, 'classes', classId, 'members', uid), ownerMember);
  await batch.commit();
  return studyClass;
}

export async function updateClassSettings(
  classId: string,
  input: {
    name: string;
    description: string;
    color: ClassThemeColor;
    icon: ClassThemeIcon;
    timezone: string;
    studyDaysOfWeek: number[];
  }
): Promise<void> {
  const now = Timestamp.now();

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const existing = state.classes[classId];
    if (!existing) throw new Error('Không tìm thấy lớp học.');
    state.classes[classId] = {
      ...existing,
      name: input.name.trim(),
      description: input.description.trim(),
      color: input.color,
      icon: input.icon,
      timezone: input.timezone,
      studyDaysOfWeek: input.studyDaysOfWeek,
      updatedAt: now,
    };
    saveDemoState(state);
    return;
  }

  const { db } = getFirebaseServices();
  await updateDoc(doc(db, 'classes', classId), {
    name: input.name.trim(),
    description: input.description.trim(),
    color: input.color,
    icon: input.icon,
    timezone: input.timezone,
    studyDaysOfWeek: input.studyDaysOfWeek,
    updatedAt: now,
  });
}

export async function listClassMembers(classId: string): Promise<ClassMember[]> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    return Object.values(state.members[classId] || {}).filter(
      (m) => m.status === 'active'
    );
  }

  const { db } = getFirebaseServices();
  const snap = await getDocs(collection(db, 'classes', classId, 'members'));
  return snap.docs
    .map((d) => d.data() as ClassMember)
    .filter((m) => m.status === 'active');
}

export async function updateMemberRole(
  classId: string,
  targetUid: string,
  newRole: 'instructor' | 'student'
): Promise<void> {
  const now = Timestamp.now();

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const m = state.members[classId]?.[targetUid];
    if (!m || m.role === 'owner') {
      throw new Error('Không thể thay đổi vai trò của chủ lớp.');
    }
    state.members[classId][targetUid] = {
      ...m,
      role: newRole,
      updatedAt: now,
    };
    saveDemoState(state);
    return;
  }

  const { db } = getFirebaseServices();
  await updateDoc(doc(db, 'classes', classId, 'members', targetUid), {
    role: newRole,
    updatedAt: now,
  });
}

export async function removeClassMember(
  classId: string,
  targetUid: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const m = state.members[classId]?.[targetUid];
    if (!m || m.role === 'owner') {
      throw new Error('Không thể xóa chủ lớp.');
    }
    delete state.members[classId][targetUid];
    saveDemoState(state);
    return;
  }

  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, 'classes', classId, 'members', targetUid));
}

// ============================================================================
// Invitations & Join Requests
// ============================================================================

export async function createInvitation(
  classId: string,
  className: string,
  ownerUid: string,
  ownerName: string,
  expiresInDays = 7
): Promise<{
  invitation: ClassInvitation;
  joinCode: string;
  compositeToken: string;
}> {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(
    Date.now() + expiresInDays * 24 * 3600 * 1000
  );
  const invitationId = `inv_${generateRandomToken(20)}`;
  const joinCode = generateJoinCode(6);
  const codeHash = await computeInvitationCodeHash(invitationId, joinCode);
  const compositeToken = encodeCompositeInviteToken(classId, invitationId);

  const invitation: ClassInvitation = {
    id: invitationId,
    classId,
    className,
    ownerName,
    codeHash,
    status: 'active',
    expiresAt,
    createdBy: ownerUid,
    createdAt: now,
  };

  const secret: InvitationSecret = {
    invitationId,
    classId,
    joinCode,
    createdAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (!state.invitations[classId]) state.invitations[classId] = {};
    if (!state.invitationSecrets[classId]) state.invitationSecrets[classId] = {};
    state.invitations[classId][invitationId] = invitation;
    state.invitationSecrets[classId][invitationId] = secret;
    saveDemoState(state);
    return { invitation, joinCode, compositeToken };
  }

  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  batch.set(doc(db, 'classes', classId, 'invitations', invitationId), invitation);
  batch.set(
    doc(db, 'classes', classId, 'invitationSecrets', invitationId),
    secret
  );
  await batch.commit();

  return { invitation, joinCode, compositeToken };
}

export async function listClassInvitationsWithSecrets(
  classId: string
): Promise<
  Array<{
    invitation: ClassInvitation;
    joinCode?: string;
    compositeToken: string;
  }>
> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const invs = Object.values(state.invitations[classId] || {});
    const secrets = state.invitationSecrets[classId] || {};
    return invs
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
      .map((inv) => ({
        invitation: inv,
        joinCode: secrets[inv.id]?.joinCode,
        compositeToken: encodeCompositeInviteToken(classId, inv.id),
      }));
  }

  const { db } = getFirebaseServices();
  const [invSnaps, secretSnaps] = await Promise.all([
    getDocs(collection(db, 'classes', classId, 'invitations')),
    getDocs(collection(db, 'classes', classId, 'invitationSecrets')),
  ]);

  const secretMap = new Map<string, string>();
  for (const sDoc of secretSnaps.docs) {
    const s = sDoc.data() as InvitationSecret;
    secretMap.set(s.invitationId, s.joinCode);
  }

  return invSnaps.docs
    .map((d) => d.data() as ClassInvitation)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .map((inv) => ({
      invitation: inv,
      joinCode: secretMap.get(inv.id),
      compositeToken: encodeCompositeInviteToken(classId, inv.id),
    }));
}

export async function revokeInvitation(
  classId: string,
  invitationId: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const inv = state.invitations[classId]?.[invitationId];
    if (inv) {
      inv.status = 'revoked';
      saveDemoState(state);
    }
    return;
  }

  const { db } = getFirebaseServices();
  await updateDoc(doc(db, 'classes', classId, 'invitations', invitationId), {
    status: 'revoked',
  });
}

export async function getInvitationByCompositeToken(
  compositeToken: string
): Promise<{
  invitation: ClassInvitation;
  classId: string;
  invitationId: string;
} | null> {
  const decoded = decodeCompositeInviteToken(compositeToken);
  if (!decoded) return null;
  const { classId, invitationId } = decoded;

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const invitation = state.invitations[classId]?.[invitationId];
    if (!invitation) return null;
    return { invitation, classId, invitationId };
  }

  const { db } = getFirebaseServices();
  const snap = await getDoc(
    doc(db, 'classes', classId, 'invitations', invitationId)
  );
  if (!snap.exists()) return null;
  return {
    invitation: snap.data() as ClassInvitation,
    classId,
    invitationId,
  };
}

export async function getMyJoinRequest(
  classId: string,
  uid: string
): Promise<JoinRequest | null> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    return state.joinRequests[classId]?.[uid] || null;
  }

  const { db } = getFirebaseServices();
  const snap = await getDoc(doc(db, 'classes', classId, 'joinRequests', uid));
  return snap.exists() ? (snap.data() as JoinRequest) : null;
}

export async function submitJoinRequest(params: {
  compositeToken: string;
  submittedCode: string;
  user: { uid: string; displayName: string; photoURL: string };
  message: string;
}): Promise<JoinRequest> {
  const decoded = decodeCompositeInviteToken(params.compositeToken);
  if (!decoded) {
    throw new Error('Đường link lời mời không hợp lệ.');
  }
  const { classId, invitationId } = decoded;
  const normalizedCode = normalizeJoinCode(params.submittedCode);

  if (normalizedCode.length < 4 || normalizedCode.length > 16) {
    throw new Error('Mã tham gia không hợp lệ.');
  }

  const now = Timestamp.now();
  const joinReq: JoinRequest = {
    uid: params.user.uid,
    classId,
    invitationId,
    submittedCode: normalizedCode,
    displayName: params.user.displayName || 'Học sinh',
    avatarUrl: params.user.photoURL || '',
    message: params.message.trim().slice(0, 300),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const inv = state.invitations[classId]?.[invitationId];
    if (!inv) {
      throw new Error('Lời mời không tồn tại.');
    }
    if (inv.status !== 'active') {
      throw new Error('Lời mời này đã bị hủy bởi chủ lớp.');
    }
    if (inv.expiresAt.toMillis() <= Date.now()) {
      throw new Error('Lời mời này đã hết hạn.');
    }
    if (state.members[classId]?.[params.user.uid]?.status === 'active') {
      throw new Error('Bạn đã là thành viên của lớp học này.');
    }
    const candidateHash = await computeInvitationCodeHash(
      invitationId,
      normalizedCode
    );
    if (candidateHash.toLowerCase() !== inv.codeHash.toLowerCase()) {
      throw new Error('Mã tham gia không chính xác. Vui lòng kiểm tra lại!');
    }
    if (!state.joinRequests[classId]) state.joinRequests[classId] = {};
    state.joinRequests[classId][params.user.uid] = joinReq;
    saveDemoState(state);
    return joinReq;
  }

  const { db } = getFirebaseServices();
  await setDoc(
    doc(db, 'classes', classId, 'joinRequests', params.user.uid),
    joinReq
  );
  return joinReq;
}

export async function listJoinRequests(classId: string): Promise<JoinRequest[]> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    return Object.values(state.joinRequests[classId] || {}).sort(
      (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()
    );
  }

  const { db } = getFirebaseServices();
  const snap = await getDocs(collection(db, 'classes', classId, 'joinRequests'));
  return snap.docs
    .map((d) => d.data() as JoinRequest)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

export async function approveJoinRequestAtomic(
  classId: string,
  joinRequest: JoinRequest
): Promise<void> {
  const now = Timestamp.now();
  const newMember: ClassMember = {
    uid: joinRequest.uid,
    classId,
    role: 'student',
    status: 'active',
    displayName: joinRequest.displayName,
    avatarUrl: joinRequest.avatarUrl || '',
    joinedAt: now,
    updatedAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (!state.members[classId]) state.members[classId] = {};
    state.members[classId][joinRequest.uid] = newMember;
    if (state.joinRequests[classId]?.[joinRequest.uid]) {
      state.joinRequests[classId][joinRequest.uid].status = 'approved';
      state.joinRequests[classId][joinRequest.uid].updatedAt = now;
    }
    saveDemoState(state);
    return;
  }

  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  batch.update(doc(db, 'classes', classId, 'joinRequests', joinRequest.uid), {
    status: 'approved',
    updatedAt: now,
  });
  batch.set(doc(db, 'classes', classId, 'members', joinRequest.uid), newMember);
  await batch.commit();
}

export async function rejectJoinRequest(
  classId: string,
  requestUid: string
): Promise<void> {
  const now = Timestamp.now();
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (state.joinRequests[classId]?.[requestUid]) {
      state.joinRequests[classId][requestUid].status = 'rejected';
      state.joinRequests[classId][requestUid].updatedAt = now;
      saveDemoState(state);
    }
    return;
  }

  const { db } = getFirebaseServices();
  await updateDoc(doc(db, 'classes', classId, 'joinRequests', requestUid), {
    status: 'rejected',
    updatedAt: now,
  });
}

// ============================================================================
// Timetable Schedules & Exceptions
// ============================================================================

export async function listSchedules(classId: string): Promise<ScheduleItem[]> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    return Object.values(state.schedules[classId] || {}).sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.periodNumber - b.periodNumber
    );
  }

  const { db } = getFirebaseServices();
  const snap = await getDocs(collection(db, 'classes', classId, 'schedules'));
  return snap.docs
    .map((d) => d.data() as ScheduleItem)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.periodNumber - b.periodNumber);
}

export async function saveScheduleItem(
  classId: string,
  uid: string,
  input: Omit<
    ScheduleItem,
    'id' | 'classId' | 'createdBy' | 'createdAt' | 'updatedAt'
  > & { id?: string }
): Promise<ScheduleItem> {
  const now = Timestamp.now();
  const scheduleId = input.id || `sch_${generateRandomToken(10)}`;
  const item: ScheduleItem = {
    id: scheduleId,
    classId,
    dayOfWeek: input.dayOfWeek,
    sessionOfDay: input.sessionOfDay,
    periodNumber: input.periodNumber,
    subject: input.subject.trim(),
    type: input.type,
    teacherName: input.teacherName.trim(),
    materialsNote: input.materialsNote.trim(),
    startTime: input.startTime.trim(),
    endTime: input.endTime.trim(),
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (!state.schedules[classId]) state.schedules[classId] = {};
    state.schedules[classId][scheduleId] = item;
    saveDemoState(state);
    return item;
  }

  const { db } = getFirebaseServices();
  await setDoc(doc(db, 'classes', classId, 'schedules', scheduleId), item);
  return item;
}

export async function deleteScheduleItem(
  classId: string,
  scheduleId: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    delete state.schedules[classId]?.[scheduleId];
    saveDemoState(state);
    return;
  }

  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, 'classes', classId, 'schedules', scheduleId));
}

export async function listScheduleExceptions(
  classId: string
): Promise<ScheduleException[]> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    return Object.values(state.scheduleExceptions[classId] || {}).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }

  const { db } = getFirebaseServices();
  const snap = await getDocs(
    collection(db, 'classes', classId, 'scheduleExceptions')
  );
  return snap.docs
    .map((d) => d.data() as ScheduleException)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveScheduleException(
  classId: string,
  uid: string,
  input: { date: string; reason: string; isDayOff: boolean }
): Promise<ScheduleException> {
  const now = Timestamp.now();
  const ex: ScheduleException = {
    id: input.date,
    classId,
    date: input.date,
    reason: input.reason.trim(),
    isDayOff: input.isDayOff,
    createdBy: uid,
    createdAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (!state.scheduleExceptions[classId]) state.scheduleExceptions[classId] = {};
    state.scheduleExceptions[classId][ex.id] = ex;
    saveDemoState(state);
    return ex;
  }

  const { db } = getFirebaseServices();
  await setDoc(doc(db, 'classes', classId, 'scheduleExceptions', ex.id), ex);
  return ex;
}

export async function deleteScheduleException(
  classId: string,
  exceptionId: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    delete state.scheduleExceptions[classId]?.[exceptionId];
    saveDemoState(state);
    return;
  }

  const { db } = getFirebaseServices();
  await deleteDoc(
    doc(db, 'classes', classId, 'scheduleExceptions', exceptionId)
  );
}

// ============================================================================
// Lessons & Teacher-Only Notes
// ============================================================================

export async function listLessons(
  classId: string,
  viewerRole: ClassRole
): Promise<Lesson[]> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const all = Object.values(state.lessons[classId] || {});
    const filtered =
      viewerRole === 'student'
        ? all.filter((l) => l.status === 'published')
        : all;
    return filtered.sort(
      (a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()
    );
  }

  const { db } = getFirebaseServices();
  const lessonsRef = collection(db, 'classes', classId, 'lessons');
  const q =
    viewerRole === 'student'
      ? query(lessonsRef, where('status', '==', 'published'))
      : query(lessonsRef);
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as Lesson)
    .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis());
}

export async function getLessonById(
  classId: string,
  lessonId: string,
  viewerRole: ClassRole
): Promise<Lesson | null> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const lesson = state.lessons[classId]?.[lessonId] || null;
    if (!lesson) return null;
    if (viewerRole === 'student' && lesson.status !== 'published') return null;
    return lesson;
  }

  try {
    const { db } = getFirebaseServices();
    const snap = await getDoc(doc(db, 'classes', classId, 'lessons', lessonId));
    if (!snap.exists()) return null;
    const lesson = snap.data() as Lesson;
    if (viewerRole === 'student' && lesson.status !== 'published') return null;
    return lesson;
  } catch (err) {
    console.warn(`[getLessonById] Không thể lấy thông tin bài học ${lessonId}:`, err);
    return null;
  }
}

export async function getLessonTeacherNote(
  classId: string,
  lessonId: string,
  viewerRole: ClassRole
): Promise<LessonNote | null> {
  if (viewerRole === 'student') {
    return null;
  }

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    return state.lessonNotes[classId]?.[lessonId] || null;
  }

  const { db } = getFirebaseServices();
  const snap = await getDoc(
    doc(db, 'classes', classId, 'lessonNotes', lessonId)
  );
  return snap.exists() ? (snap.data() as LessonNote) : null;
}

export async function saveLessonWithTeacherNote(
  classId: string,
  uid: string,
  input: {
    id?: string;
    subject: string;
    unitTitle?: string;
    ttsLang?: SupportedTtsLang;
    title: string;
    goal: string;
    keywords: LessonKeyword[];
    explanation: string;
    resourceUrl: string;
    status: LessonStatus;
    teacherNoteContent: string;
  }
): Promise<Lesson> {
  const now = Timestamp.now();
  const lessonId = input.id || `les_${generateRandomToken(10)}`;
  const lesson: Lesson = {
    id: lessonId,
    classId,
    subject: input.subject.trim(),
    unitTitle: (input.unitTitle || '').trim(),
    ttsLang: input.ttsLang || '',
    title: input.title.trim(),
    goal: input.goal.trim(),
    keywords: input.keywords,
    explanation: input.explanation.trim(),
    resourceUrl: input.resourceUrl.trim(),
    status: input.status,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  };

  const note: LessonNote = {
    lessonId,
    classId,
    content: input.teacherNoteContent.trim(),
    updatedBy: uid,
    updatedAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (!state.lessons[classId]) state.lessons[classId] = {};
    if (!state.lessonNotes[classId]) state.lessonNotes[classId] = {};
    state.lessons[classId][lessonId] = lesson;
    state.lessonNotes[classId][lessonId] = note;
    saveDemoState(state);
    return lesson;
  }

  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  batch.set(doc(db, 'classes', classId, 'lessons', lessonId), lesson);
  batch.set(doc(db, 'classes', classId, 'lessonNotes', lessonId), note);
  await batch.commit();
  return lesson;
}

export async function deleteLesson(
  classId: string,
  lessonId: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    delete state.lessons[classId]?.[lessonId];
    delete state.lessonNotes[classId]?.[lessonId];
    saveDemoState(state);
    return;
  }

  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'classes', classId, 'lessons', lessonId));
  batch.delete(doc(db, 'classes', classId, 'lessonNotes', lessonId));
  await batch.commit();
}

// ============================================================================
// Study Sessions & Assignments
// ============================================================================

export async function listSessions(
  classId: string,
  maxCount = 30
): Promise<StudySession[]> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    return Object.values(state.sessions[classId] || {})
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, maxCount);
  }

  const { db } = getFirebaseServices();
  const q = query(
    collection(db, 'classes', classId, 'sessions'),
    orderBy('date', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as StudySession);
}

export async function getSessionById(
  classId: string,
  sessionId: string
): Promise<StudySession | null> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    return state.sessions[classId]?.[sessionId] || null;
  }

  const { db } = getFirebaseServices();
  const snap = await getDoc(doc(db, 'classes', classId, 'sessions', sessionId));
  return snap.exists() ? (snap.data() as StudySession) : null;
}

export async function saveSession(
  classId: string,
  uid: string,
  input: {
    id?: string;
    date: string;
    title: string;
    goal: string;
    durationMinutes: number;
    lessonIds: string[];
    checklist: SessionChecklistItem[];
    status: StudySessionStatus;
    summaryNote: string;
  }
): Promise<StudySession> {
  const now = Timestamp.now();
  const sessionId = input.id || `ses_${generateRandomToken(10)}`;
  const session: StudySession = {
    id: sessionId,
    classId,
    date: input.date,
    title: input.title.trim(),
    goal: input.goal.trim(),
    durationMinutes: input.durationMinutes,
    lessonIds: input.lessonIds,
    checklist: input.checklist,
    status: input.status,
    summaryNote: input.summaryNote.trim(),
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (!state.sessions[classId]) state.sessions[classId] = {};
    state.sessions[classId][sessionId] = session;
    saveDemoState(state);
    return session;
  }

  const { db } = getFirebaseServices();
  await setDoc(doc(db, 'classes', classId, 'sessions', sessionId), session);
  return session;
}

export async function deleteSession(
  classId: string,
  sessionId: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    delete state.sessions[classId]?.[sessionId];
    saveDemoState(state);
    return;
  }

  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, 'classes', classId, 'sessions', sessionId));
}

export async function listAssignments(
  classId: string,
  viewerUid: string,
  viewerRole: ClassRole
): Promise<Assignment[]> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const all = Object.values(state.assignments[classId] || {});
    const filtered =
      viewerRole === 'student'
        ? all.filter(
            (a) =>
              a.assignedStudentUids.includes(viewerUid) ||
              a.assignedStudentUids.includes('ALL')
          )
        : all;
    return filtered.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  const { db } = getFirebaseServices();
  const ref = collection(db, 'classes', classId, 'assignments');
  const q =
    viewerRole === 'student'
      ? query(
          ref,
          where('assignedStudentUids', 'array-contains-any', [viewerUid, 'ALL'])
        )
      : query(ref);
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as Assignment)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function saveAssignment(
  classId: string,
  uid: string,
  input: {
    id?: string;
    sessionId: string | null;
    lessonId: string | null;
    title: string;
    description: string;
    dueDate: string;
    assignedStudentUids: string[];
    starsReward: number;
    taskType?: 'standard' | 'flashcard' | 'quiz';
    subject?: string;
    unitTitle?: string;
    ttsLang?: SupportedTtsLang;
    flashcards?: LessonKeyword[];
    quizQuestions?: QuizQuestion[];
  }
): Promise<Assignment> {
  const now = Timestamp.now();
  const assignmentId = input.id || `tsk_${generateRandomToken(10)}`;
  const assignment: Assignment = {
    id: assignmentId,
    classId,
    sessionId: input.sessionId,
    lessonId: input.lessonId,
    title: input.title.trim(),
    description: input.description.trim(),
    dueDate: input.dueDate,
    assignedStudentUids: input.assignedStudentUids,
    starsReward: input.starsReward,
    taskType: input.taskType || 'standard',
    subject: (input.subject || '').trim(),
    unitTitle: (input.unitTitle || '').trim(),
    ttsLang: input.ttsLang || '',
    flashcards: input.flashcards || [],
    quizQuestions: input.quizQuestions || [],
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (!state.assignments[classId]) state.assignments[classId] = {};
    state.assignments[classId][assignmentId] = assignment;
    saveDemoState(state);
    return assignment;
  }

  const { db } = getFirebaseServices();
  await setDoc(
    doc(db, 'classes', classId, 'assignments', assignmentId),
    assignment
  );
  return assignment;
}

export async function deleteAssignment(
  classId: string,
  assignmentId: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    delete state.assignments[classId]?.[assignmentId];
    saveDemoState(state);
    return;
  }

  const { db } = getFirebaseServices();
  await deleteDoc(doc(db, 'classes', classId, 'assignments', assignmentId));
}

// ============================================================================
// Learning Records (Student Submissions & Instructor Confirmations)
// ============================================================================

export async function listLearningRecords(
  classId: string,
  viewerUid: string,
  viewerRole: ClassRole,
  maxRecords = 60
): Promise<LearningRecord[]> {
  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const all = Object.values(state.learningRecords[classId] || {}).filter(
      (r) => !r.id.startsWith('srs_')
    );
    const filtered =
      viewerRole === 'student'
        ? all.filter((r) => r.studentUid === viewerUid)
        : all;
    return filtered
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, maxRecords);
  }

  const { db } = getFirebaseServices();
  const ref = collection(db, 'classes', classId, 'learningRecords');
  const q =
    viewerRole === 'student'
      ? query(
          ref,
          where('studentUid', '==', viewerUid),
          limit(maxRecords + 5)
        )
      : query(ref, limit(maxRecords + 5));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as LearningRecord)
    .filter((r) => !r.id.startsWith('srs_'))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, maxRecords);
}

export async function submitStudentCompletion(params: {
  classId: string;
  studentUid: string;
  studentName: string;
  type: 'assignment' | 'session';
  assignmentId: string | null;
  sessionId: string | null;
  title: string;
  date: string;
  studentNote: string;
  quizScore?: number;
  quizTotal?: number;
}): Promise<LearningRecord> {
  const now = Timestamp.now();
  const recordId = params.assignmentId
    ? `${params.assignmentId}_${params.studentUid}`
    : `session_${params.sessionId || params.date}_${params.studentUid}`;

  const record: LearningRecord = {
    id: recordId,
    classId: params.classId,
    studentUid: params.studentUid,
    studentName: params.studentName,
    type: params.type,
    assignmentId: params.assignmentId,
    sessionId: params.sessionId,
    title: params.title,
    date: params.date,
    studentStatus: 'submitted',
    studentNote: params.studentNote.trim().slice(0, 500),
    submittedAt: now,
    instructorStatus: 'unverified',
    instructorComment: '',
    starsAwarded: 0,
    confirmedBy: null,
    confirmedAt: null,
    ...(params.quizScore !== undefined ? { quizScore: params.quizScore } : {}),
    ...(params.quizTotal !== undefined ? { quizTotal: params.quizTotal } : {}),
    createdAt: now,
    updatedAt: now,
  };

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (!state.learningRecords[params.classId]) {
      state.learningRecords[params.classId] = {};
    }
    const existing = state.learningRecords[params.classId][recordId];
    if (existing && existing.instructorStatus === 'confirmed') {
      throw new Error('Nhiệm vụ này đã được giáo viên xác nhận, không thể chỉnh sửa.');
    }
    state.learningRecords[params.classId][recordId] = record;
    saveDemoState(state);
    return record;
  }

  const { db } = getFirebaseServices();
  const ref = doc(db, 'classes', params.classId, 'learningRecords', recordId);
  const existingSnap = await getDoc(ref);
  if (existingSnap.exists()) {
    await updateDoc(ref, {
      studentStatus: 'submitted',
      studentNote: record.studentNote,
      submittedAt: now,
      updatedAt: now,
      ...(params.quizScore !== undefined ? { quizScore: params.quizScore } : {}),
      ...(params.quizTotal !== undefined ? { quizTotal: params.quizTotal } : {}),
    });
    return { ...(existingSnap.data() as LearningRecord), ...record };
  }
  await setDoc(ref, record);
  return record;
}

export async function getStudentSrsStates(
  classId: string,
  studentUid: string
): Promise<Record<string, SrsCardProgress>> {
  const srsDocId = `srs_${studentUid}`;

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    const rec = state.learningRecords[classId]?.[srsDocId];
    return rec?.srsStates || {};
  }

  try {
    const { db } = getFirebaseServices();
    const snap = await getDoc(
      doc(db, 'classes', classId, 'learningRecords', srsDocId)
    );
    if (!snap.exists()) return {};
    const data = snap.data() as LearningRecord;
    return data.srsStates || {};
  } catch {
    // Trả về rỗng nếu tài liệu chưa tạo hoặc người dùng chưa có lịch sử học SRS
    return {};
  }
}

export async function saveStudentSrsStates(params: {
  classId: string;
  studentUid: string;
  studentName: string;
  todayDateStr: string;
  srsStates: Record<string, SrsCardProgress>;
}): Promise<Record<string, SrsCardProgress>> {
  const now = Timestamp.now();
  const srsDocId = `srs_${params.studentUid}`;

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (!state.learningRecords[params.classId]) {
      state.learningRecords[params.classId] = {};
    }
    const existing = state.learningRecords[params.classId][srsDocId];
    const mergedStates = {
      ...(existing?.srsStates || {}),
      ...params.srsStates,
    };
    state.learningRecords[params.classId][srsDocId] = {
      id: srsDocId,
      classId: params.classId,
      studentUid: params.studentUid,
      studentName: params.studentName,
      type: 'session',
      assignmentId: null,
      sessionId: null,
      title: 'Tiến độ ghi nhớ Flashcard (SRS)',
      date: existing?.date || params.todayDateStr,
      studentStatus: 'submitted',
      studentNote: `Đã cập nhật ${Object.keys(mergedStates).length} thẻ ghi nhớ`,
      submittedAt: now,
      instructorStatus: 'unverified',
      instructorComment: '',
      starsAwarded: 0,
      confirmedBy: null,
      confirmedAt: null,
      srsStates: mergedStates,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    saveDemoState(state);
    return mergedStates;
  }

  const { db } = getFirebaseServices();
  const ref = doc(db, 'classes', params.classId, 'learningRecords', srsDocId);
  const existingSnap = await getDoc(ref);
  if (existingSnap.exists()) {
    const existing = existingSnap.data() as LearningRecord;
    const mergedStates = {
      ...(existing.srsStates || {}),
      ...params.srsStates,
    };
    await updateDoc(ref, {
      studentStatus: 'submitted',
      studentNote: `Đã cập nhật ${Object.keys(mergedStates).length} thẻ ghi nhớ`,
      srsStates: mergedStates,
      updatedAt: now,
    });
    return mergedStates;
  }

  const created: LearningRecord = {
    id: srsDocId,
    classId: params.classId,
    studentUid: params.studentUid,
    studentName: params.studentName,
    type: 'session',
    assignmentId: null,
    sessionId: null,
    title: 'Tiến độ ghi nhớ Flashcard (SRS)',
    date: params.todayDateStr,
    studentStatus: 'submitted',
    studentNote: `Đã cập nhật ${Object.keys(params.srsStates).length} thẻ ghi nhớ`,
    submittedAt: now,
    instructorStatus: 'unverified',
    instructorComment: '',
    starsAwarded: 0,
    confirmedBy: null,
    confirmedAt: null,
    srsStates: params.srsStates,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, created);
  return params.srsStates;
}

export async function confirmOrReviewLearningRecord(params: {
  classId: string;
  instructorUid: string;
  recordId: string;
  studentUid: string;
  studentName: string;
  type: 'assignment' | 'session';
  assignmentId: string | null;
  sessionId: string | null;
  title: string;
  date: string;
  instructorStatus: InstructorReviewStatus;
  starsAwarded: number;
  instructorComment: string;
}): Promise<LearningRecord> {
  const now = Timestamp.now();

  if (!isFirebaseConfigured) {
    const state = loadDemoState();
    if (!state.learningRecords[params.classId]) {
      state.learningRecords[params.classId] = {};
    }
    const existing = state.learningRecords[params.classId][params.recordId];
    const updated: LearningRecord = existing
      ? {
          ...existing,
          instructorStatus: params.instructorStatus,
          starsAwarded:
            params.instructorStatus === 'confirmed' ? params.starsAwarded : 0,
          instructorComment: params.instructorComment.trim().slice(0, 1000),
          confirmedBy: params.instructorUid,
          confirmedAt: now,
          updatedAt: now,
        }
      : {
          id: params.recordId,
          classId: params.classId,
          studentUid: params.studentUid,
          studentName: params.studentName,
          type: params.type,
          assignmentId: params.assignmentId,
          sessionId: params.sessionId,
          title: params.title,
          date: params.date,
          studentStatus: 'submitted',
          studentNote: '',
          submittedAt: now,
          instructorStatus: params.instructorStatus,
          instructorComment: params.instructorComment.trim().slice(0, 1000),
          starsAwarded:
            params.instructorStatus === 'confirmed' ? params.starsAwarded : 0,
          confirmedBy: params.instructorUid,
          confirmedAt: now,
          createdAt: now,
          updatedAt: now,
        };
    state.learningRecords[params.classId][params.recordId] = updated;
    saveDemoState(state);
    return updated;
  }

  const { db } = getFirebaseServices();
  const ref = doc(
    db,
    'classes',
    params.classId,
    'learningRecords',
    params.recordId
  );
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const patch = {
      instructorStatus: params.instructorStatus,
      starsAwarded:
        params.instructorStatus === 'confirmed' ? params.starsAwarded : 0,
      instructorComment: params.instructorComment.trim().slice(0, 1000),
      confirmedBy: params.instructorUid,
      confirmedAt: now,
      updatedAt: now,
    };
    await updateDoc(ref, patch);
    return { ...(snap.data() as LearningRecord), ...patch };
  }

  const created: LearningRecord = {
    id: params.recordId,
    classId: params.classId,
    studentUid: params.studentUid,
    studentName: params.studentName,
    type: params.type,
    assignmentId: params.assignmentId,
    sessionId: params.sessionId,
    title: params.title,
    date: params.date,
    studentStatus: 'submitted',
    studentNote: '',
    submittedAt: now,
    instructorStatus: params.instructorStatus,
    instructorComment: params.instructorComment.trim().slice(0, 1000),
    starsAwarded:
      params.instructorStatus === 'confirmed' ? params.starsAwarded : 0,
    confirmedBy: params.instructorUid,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, created);
  return created;
}

