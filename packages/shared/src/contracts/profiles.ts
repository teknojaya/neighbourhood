import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, LatLngSchema } from '../common.js';
import { CommunityRoleSchema, PlatformRoleSchema, UiLanguageSchema } from '../enums.js';
import { RadiusKmSchema } from '../geo.js';

export const DisplayNameSchema = z.string().trim().min(2).max(60);

/** Visible to other signed-in users. */
export const PublicProfileSchema = z.object({
  userId: IdSchema,
  displayName: DisplayNameSchema.nullable(),
  areaLabel: z.string().max(120).nullable(),
  createdAt: IsoDateTimeSchema,
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

/** Returned only to the signed-in user. */
export const MeSchema = z.object({
  /** Internal PostgreSQL user id (use this in all other APIs). */
  userId: IdSchema,
  email: z.string().email(),
  emailVerified: z.boolean(),
  /** How the current session signed in: Google or email OTP (custom token). */
  signInMethod: z.enum(['google', 'email_otp']),
  profile: z.object({
    /** Null until the user completes profile setup. */
    displayName: DisplayNameSchema.nullable(),
    preferredLanguage: UiLanguageSchema,
    areaLabel: z.string().max(120).nullable(),
    /** Exact home point. Private: never copied into public DTOs. */
    homeLocation: LatLngSchema.nullable(),
    searchRadiusKm: RadiusKmSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  }),
  /** Server-controlled. Read-only for clients. */
  platformRoles: z.array(PlatformRoleSchema),
  memberships: z.array(z.object({ communityId: IdSchema, role: CommunityRoleSchema })),
});
export type Me = z.infer<typeof MeSchema>;

/** PUT /api/v1/me/profile — update own profile. No identity or role fields accepted. */
export const UpsertProfileBodySchema = z.strictObject({
  displayName: DisplayNameSchema,
  preferredLanguage: UiLanguageSchema.default('en'),
  areaLabel: z.string().trim().max(120).nullable().default(null),
  homeLocation: LatLngSchema.nullable().default(null),
  searchRadiusKm: RadiusKmSchema,
});
export type UpsertProfileBody = z.infer<typeof UpsertProfileBodySchema>;
