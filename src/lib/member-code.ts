/**
 * What a member's bar-card QR code contains. It only identifies the member;
 * charging still requires a signed-in bar staff account, so the code is not a secret.
 */
const PREFIX = 'golfapp:member:';

export const memberCode = (clubId: string, userId: string) => `${PREFIX}${clubId}:${userId}`;

export function parseMemberCode(data: string): { clubId: string; userId: string } | null {
  if (!data.startsWith(PREFIX)) return null;
  const [clubId, userId] = data.slice(PREFIX.length).split(':');
  return clubId && userId ? { clubId, userId } : null;
}
