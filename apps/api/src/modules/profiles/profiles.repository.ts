import { DEFAULT_RADIUS_KM, type LatLng, type RadiusKm, RadiusKmSchema, type UiLanguage } from '@neighbourhood/shared';
import type { Db } from '../../lib/db.js';

export interface StoredProfile {
  displayName: string | null;
  areaLabel: string | null;
  preferredLanguage: UiLanguage;
  /** Private: exact home point. */
  homeLocation: LatLng | null;
  searchRadiusKm: RadiusKm;
  createdAt: string;
  updatedAt: string;
}

export type ProfileUpdate = Omit<StoredProfile, 'createdAt' | 'updatedAt'>;

export interface ProfilesRepository {
  get(userId: string): Promise<StoredProfile | null>;
  update(userId: string, profile: ProfileUpdate): Promise<void>;
}

/** Profile fields live on the `users` row (one row per person). */
export class PrismaProfilesRepository implements ProfilesRepository {
  constructor(private readonly db: Db) {}

  async get(userId: string): Promise<StoredProfile | null> {
    const u = await this.db.user.findUnique({ where: { id: userId } });
    if (!u) return null;
    const radius = RadiusKmSchema.safeParse(u.searchRadiusKm);
    return {
      displayName: u.displayName,
      areaLabel: u.areaLabel,
      preferredLanguage: u.preferredLanguage,
      homeLocation: u.homeLat !== null && u.homeLng !== null ? { lat: u.homeLat, lng: u.homeLng } : null,
      searchRadiusKm: radius.success ? radius.data : DEFAULT_RADIUS_KM,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }

  async update(userId: string, p: ProfileUpdate): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        displayName: p.displayName,
        areaLabel: p.areaLabel,
        preferredLanguage: p.preferredLanguage,
        homeLat: p.homeLocation?.lat ?? null,
        homeLng: p.homeLocation?.lng ?? null,
        searchRadiusKm: p.searchRadiusKm,
      },
    });
  }
}
