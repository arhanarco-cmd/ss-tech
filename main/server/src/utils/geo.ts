import { Request } from "express";

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
  asn: string | null;
}

export function extractGeo(req: Request): GeoInfo {
  return {
    country: (req.headers["cf-ipcountry"] as string) ?? null,
    region: (req.headers["cf-region"] as string) ?? null,
    city: (req.headers["cf-ipcity"] as string) ?? null,
    asn: (req.headers["cf-asn"] as string) ?? null,
  };
}

