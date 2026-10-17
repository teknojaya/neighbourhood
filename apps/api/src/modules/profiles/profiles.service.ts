import type { Me, UpsertProfileBody } from '@neighbourhood/shared';
import { HttpError } from '../../lib/http.js';
import type { AccessRepository } from '../auth/access.js';
import type { AuthUser } from '../auth/auth.js';
import type { ProfilesRepository } from './profiles.repository.js';

export class ProfilesService {
  constructor(
    private readonly profiles: ProfilesRepository,
    private readonly access: AccessRepository,
  ) {}

  async getMe(user: AuthUser): Promise<Me> {
    const [profile, platformRoles, memberships] = await Promise.all([
      this.profiles.get(user.userId),
      this.access.getPlatformRoles(user.userId),
      this.access.listActiveMemberships(user.userId),
    ]);
    if (!profile) throw new HttpError('NOT_FOUND', 'User not found');
    return {
      userId: user.userId,
      email: user.email,
      emailVerified: user.emailVerified,
      signInMethod: user.signInMethod,
      profile,
      platformRoles,
      memberships: memberships.map((m) => ({ communityId: m.communityId, role: m.role })),
    };
  }

  /** The user id always comes from the verified token mapping, never from the body. */
  async upsertProfile(user: AuthUser, body: UpsertProfileBody): Promise<Me> {
    await this.profiles.update(user.userId, {
      displayName: body.displayName,
      areaLabel: body.areaLabel,
      preferredLanguage: body.preferredLanguage,
      homeLocation: body.homeLocation,
      searchRadiusKm: body.searchRadiusKm,
    });
    return this.getMe(user);
  }
}
