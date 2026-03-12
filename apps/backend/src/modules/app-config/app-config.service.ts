import { Injectable } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import {
  UpdateMobileHomeContentDto,
  UpdateMobileHomePromoDto
} from './dto/update-mobile-home-content.dto';

export interface MobileHomeBillboard {
  eyebrow: string;
  title: string;
  subtitle: string;
  tags: string[];
}

export interface MobileHomePromo {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  cta: string;
  colors: [string, string];
}

export interface MobileHomeContent {
  version: number;
  updatedAt: string;
  billboard: MobileHomeBillboard;
  promos: MobileHomePromo[];
}

interface MobileHomeContentInput {
  version?: number;
  updatedAt?: string;
  billboard?: Partial<MobileHomeBillboard>;
  promos?: Array<Partial<MobileHomePromo> | Partial<UpdateMobileHomePromoDto>>;
}

const MOBILE_HOME_CONFIG_KEY = 'app_config:mobile_home:v1';

const DEFAULT_MOBILE_HOME_CONTENT: MobileHomeContent = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  billboard: {
    eyebrow: 'HOME OFFER',
    title: 'First 3 rides at launch discount.',
    subtitle: 'Set route now and QARGO applies the best available customer offer.',
    tags: ['Instant pickup', 'Live ETA', 'Transparent fares']
  },
  promos: [
    {
      id: 'promo-first-load',
      tag: 'New User Offer',
      title: 'Get 15% off on your first three rides',
      subtitle: 'Apply automatically after route setup.',
      cta: 'Start now',
      colors: ['#1D4ED8', '#0F766E']
    },
    {
      id: 'promo-bangalore-rush',
      tag: 'Rush Hours',
      title: 'Priority matching in Bengaluru city lanes',
      subtitle: 'Faster assignment during office peaks.',
      cta: 'Book priority',
      colors: ['#0F172A', '#2563EB']
    },
    {
      id: 'promo-fleet',
      tag: 'Multi-vehicle',
      title: 'Mini-truck and 3W availability today',
      subtitle: 'Choose the best fit once drop is set.',
      cta: 'Explore rides',
      colors: ['#7C3AED', '#1D4ED8']
    }
  ]
};

function trimWithFallback(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function normalizePromo(
  input: Partial<UpdateMobileHomePromoDto> | null | undefined,
  fallback: MobileHomePromo,
  index: number
): MobileHomePromo {
  const id = trimWithFallback(input?.id, fallback.id || `promo-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || `promo-${index + 1}`;

  const firstColor = trimWithFallback(input?.colors?.[0], fallback.colors[0]);
  const secondColor = trimWithFallback(input?.colors?.[1], fallback.colors[1]);

  return {
    id,
    tag: trimWithFallback(input?.tag, fallback.tag),
    title: trimWithFallback(input?.title, fallback.title),
    subtitle: trimWithFallback(input?.subtitle, fallback.subtitle),
    cta: trimWithFallback(input?.cta, fallback.cta),
    colors: [
      isHexColor(firstColor) ? firstColor : fallback.colors[0],
      isHexColor(secondColor) ? secondColor : fallback.colors[1]
    ]
  };
}

function normalizeMobileHomeContent(
  input: MobileHomeContentInput | null | undefined,
  fallback: MobileHomeContent
): MobileHomeContent {
  const rawTags = Array.isArray(input?.billboard?.tags) ? input?.billboard?.tags : fallback.billboard.tags;
  const tags = rawTags
    .map((value) => trimWithFallback(value, ''))
    .filter((value) => value.length > 0)
    .slice(0, 6);

  const promosSource =
    Array.isArray(input?.promos) && input.promos.length > 0
      ? input.promos
      : fallback.promos;

  const promos = promosSource
    .slice(0, 8)
    .map((promo, index) =>
      normalizePromo(
        promo,
        fallback.promos[index] ?? fallback.promos[fallback.promos.length - 1],
        index
      )
    );

  const parsedVersion = Number(input?.version);
  const version = Number.isFinite(parsedVersion) && parsedVersion > 0 ? Math.trunc(parsedVersion) : fallback.version;
  const updatedAt = trimWithFallback(input?.updatedAt, fallback.updatedAt);

  return {
    version,
    updatedAt,
    billboard: {
      eyebrow: trimWithFallback(input?.billboard?.eyebrow, fallback.billboard.eyebrow),
      title: trimWithFallback(input?.billboard?.title, fallback.billboard.title),
      subtitle: trimWithFallback(input?.billboard?.subtitle, fallback.billboard.subtitle),
      tags: tags.length > 0 ? tags : fallback.billboard.tags
    },
    promos
  };
}

@Injectable()
export class AppConfigService {
  constructor(private readonly redisService: RedisService) {}

  private async readStoredMobileHomeContent() {
    const raw = await this.redisService.getClient().get(MOBILE_HOME_CONFIG_KEY);
    if (!raw) {
      return null;
    }

    try {
      return normalizeMobileHomeContent(JSON.parse(raw) as MobileHomeContentInput, DEFAULT_MOBILE_HOME_CONTENT);
    } catch {
      return null;
    }
  }

  async getMobileHomeContent() {
    const stored = await this.readStoredMobileHomeContent();
    return {
      source: stored ? 'redis' : 'default',
      ...normalizeMobileHomeContent(stored, DEFAULT_MOBILE_HOME_CONTENT)
    };
  }

  async updateMobileHomeContent(payload: UpdateMobileHomeContentDto) {
    const current = await this.readStoredMobileHomeContent();
    const nowIso = new Date().toISOString();

    const next = normalizeMobileHomeContent(
      {
        billboard: payload.billboard,
        promos: payload.promos,
        version: (current?.version ?? DEFAULT_MOBILE_HOME_CONTENT.version) + 1,
        updatedAt: nowIso
      },
      current ?? DEFAULT_MOBILE_HOME_CONTENT
    );

    await this.redisService.getClient().set(MOBILE_HOME_CONFIG_KEY, JSON.stringify(next));

    return {
      source: 'redis',
      ...next
    };
  }
}
