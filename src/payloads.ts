/**
 * japofc-qr - payload builders
 *
 * Wi-Fi credentials, contact cards, calendar events and the other formats
 * phones recognise are just strings with a very specific syntax. These helpers
 * build that syntax for you, including the escaping each format requires, so a
 * QR code can be encoded with `QrCode.encodeText(QrPayload.wifi({ ... }))`.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

/** Wireless security type understood by the `WIFI:` format. */
export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

/** Options for {@link QrPayload.wifi}. */
export interface WifiPayload {
  /** Network name (SSID). */
  readonly ssid: string;
  /** Password. Omit for open networks. */
  readonly password?: string;
  /** Security type. Defaults to `WPA`. */
  readonly security?: WifiSecurity;
  /** Mark the network as hidden. Defaults to `false`. */
  readonly hidden?: boolean;
}

/** Options for {@link QrPayload.vCard} and {@link QrPayload.mecard}. */
export interface ContactPayload {
  readonly firstName?: string;
  readonly lastName?: string;
  /** Display name. Defaults to `firstName lastName`. */
  readonly displayName?: string;
  readonly organization?: string;
  readonly title?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly website?: string;
  readonly address?: string;
}

/** Options for {@link QrPayload.event}. */
export interface EventPayload {
  readonly summary: string;
  /** Start date. A `Date` is written as UTC; a string is written verbatim. */
  readonly start: Date | string;
  readonly end: Date | string;
  readonly location?: string;
  readonly description?: string;
}

/** Options for {@link QrPayload.sms}. */
export interface SmsPayload {
  readonly phone: string;
  readonly body?: string;
}

/** Options for {@link QrPayload.email}. */
export interface EmailPayload {
  readonly to: string;
  readonly subject?: string;
  readonly body?: string;
}

/** Options for {@link QrPayload.geo}. */
export interface GeoPayload {
  readonly latitude: number;
  readonly longitude: number;
  /** Optional query to bias the map, e.g. a place name. */
  readonly query?: string;
}

/** Options for {@link QrPayload.whatsapp}. */
export interface WhatsappPayload {
  /** Phone number with country code, digits only, e.g. `6281234567890`. */
  readonly phone: string;
  /** Pre-filled message. */
  readonly message?: string;
}

/**
 * Builders for the payload formats phones recognise natively.
 *
 * Every function returns a plain string, so it composes with anything else
 * that expects text — including `QrCode.encodeText()`.
 */
export const QrPayload = {
  /** `WIFI:T:WPA;S:name;P:password;;` — opens the Wi-Fi settings sheet. */
  wifi(payload: WifiPayload): string {
    const security = payload.security ?? (payload.password ? 'WPA' : 'nopass');
    const fields = [`T:${security}`, `S:${escapeWifi(payload.ssid)}`];

    if (payload.password !== undefined) {
      fields.push(`P:${escapeWifi(payload.password)}`);
    }
    if (payload.hidden) {
      fields.push('H:true');
    }

    return `WIFI:${fields.join(';')};;`;
  },

  /** vCard 3.0, the format iOS and Android both import into Contacts. */
  vCard(payload: ContactPayload): string {
    const displayName =
      payload.displayName ?? [payload.firstName, payload.lastName].filter(Boolean).join(' ');

    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    lines.push(`N:${vcardText(payload.lastName ?? '')};${vcardText(payload.firstName ?? '')};;;`);
    lines.push(`FN:${vcardText(displayName)}`);

    if (payload.organization) {
      lines.push(`ORG:${vcardText(payload.organization)}`);
    }
    if (payload.title) {
      lines.push(`TITLE:${vcardText(payload.title)}`);
    }
    if (payload.phone) {
      lines.push(`TEL;TYPE=CELL:${vcardText(payload.phone)}`);
    }
    if (payload.email) {
      lines.push(`EMAIL;TYPE=INTERNET:${vcardText(payload.email)}`);
    }
    if (payload.website) {
      lines.push(`URL:${vcardText(payload.website)}`);
    }
    if (payload.address) {
      lines.push(`ADR;TYPE=WORK:;;${vcardText(payload.address)};;;;`);
    }

    lines.push('END:VCARD');
    return lines.map(foldVcardLine).join('\r\n') + '\r\n';
  },

  /** MECARD, the compact format most Japanese and older Android readers expect. */
  mecard(payload: ContactPayload): string {
    const fields = [`N:${mecardText(payload.lastName ?? '')},${mecardText(payload.firstName ?? '')}`];

    if (payload.displayName) {
      fields.push(`NICKNAME:${mecardText(payload.displayName)}`);
    }
    if (payload.phone) {
      fields.push(`TEL:${mecardText(payload.phone)}`);
    }
    if (payload.email) {
      fields.push(`EMAIL:${mecardText(payload.email)}`);
    }
    if (payload.website) {
      fields.push(`URL:${mecardText(payload.website)}`);
    }
    if (payload.organization) {
      fields.push(`ORG:${mecardText(payload.organization)}`);
    }

    return `MECARD:${fields.join(';')};;`;
  },

  /** iCalendar event, imported by every calendar app. */
  event(payload: EventPayload): string {
    const stamp = toUtcStamp(new Date());
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//japofc-qr//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@japofc-qr`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatDate(payload.start)}`,
      `DTEND:${formatDate(payload.end)}`,
      `SUMMARY:${icalText(payload.summary)}`,
    ];

    if (payload.location) {
      lines.push(`LOCATION:${icalText(payload.location)}`);
    }
    if (payload.description) {
      lines.push(`DESCRIPTION:${icalText(payload.description)}`);
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.map(foldVcardLine).join('\r\n') + '\r\n';
  },

  /** `geo:latitude,longitude` — opens the maps app at that point. */
  geo(payload: GeoPayload): string {
    const coordinates = `${payload.latitude},${payload.longitude}`;
    return payload.query ? `geo:${coordinates}?q=${encodeURIComponent(payload.query)}` : `geo:${coordinates}`;
  },

  /** `SMSTO:number:message` — opens the messaging app with the number filled in. */
  sms(payload: SmsPayload): string {
    return payload.body === undefined ? `SMSTO:${payload.phone}` : `SMSTO:${payload.phone}:${payload.body}`;
  },

  /** `mailto:` with optional subject and body. */
  email(payload: EmailPayload): string {
    const parameters = new URLSearchParams();
    if (payload.subject) {
      parameters.set('subject', payload.subject);
    }
    if (payload.body) {
      parameters.set('body', payload.body);
    }

    const query = parameters.toString();
    return query ? `mailto:${payload.to}?${query}` : `mailto:${payload.to}`;
  },

  /** `tel:` for a one-tap call. */
  tel(phone: string): string {
    return `tel:${phone}`;
  },

  /**
   * `https://wa.me/<number>?text=<message>` — opens a WhatsApp chat, optionally
   * with the message typed out. The number must be digits only, including the
   * country code and no leading `+`.
   */
  whatsapp(payload: WhatsappPayload): string {
    const digits = payload.phone.replace(/[^\d]/g, '');
    if (digits.length === 0) {
      throw new RangeError('QrPayload.whatsapp(): the phone number must contain digits.');
    }

    return payload.message
      ? `https://wa.me/${digits}?text=${encodeURIComponent(payload.message)}`
      : `https://wa.me/${digits}`;
  },
};

/** Escapes `\`, `;`, `,` and `:` as required by the `WIFI:` format. */
function escapeWifi(value: string): string {
  return value.replace(/[\\;,:]/g, (character) => `\\${character}`);
}

/** Escapes `\`, `;`, `,` and newlines as required by vCard. */
function vcardText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Escapes `\`, `;`, `,` and `:` as required by MECARD. */
function mecardText(value: string): string {
  return value.replace(/[\\;,:]/g, (character) => `\\${character}`);
}

/** Escapes `\`, `;`, `,` and newlines as required by iCalendar. */
function icalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** vCard and iCalendar fold physical lines longer than 75 octets. */
function foldVcardLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }

  const parts: string[] = [];
  let cursor = 0;
  while (cursor < line.length) {
    parts.push(cursor === 0 ? line.slice(cursor, cursor + 75) : line.slice(cursor, cursor + 74));
    cursor += cursor === 0 ? 75 : 74;
  }

  return parts.join('\r\n ');
}

/** Writes a `Date` as a UTC iCalendar timestamp, or passes a string through. */
function formatDate(value: Date | string): string {
  return typeof value === 'string' ? value : toUtcStamp(value);
}

function toUtcStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}
