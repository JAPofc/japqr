/**
 * japofc-qr - payload builder tests
 *
 * These formats are parsed by phones, so the strings have to be exact. Each
 * test pins the syntax the reader expects, including the escaping rules.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QrPayload, QrCode } from '../dist/esm/index.js';

test('wifi defaults to WPA when a password is given', () => {
  assert.equal(QrPayload.wifi({ ssid: 'Cafe', password: 'secret' }), 'WIFI:T:WPA;S:Cafe;P:secret;;');
});

test('wifi defaults to nopass without a password', () => {
  assert.equal(QrPayload.wifi({ ssid: 'Guest' }), 'WIFI:T:nopass;S:Guest;;');
});

test('wifi escapes the characters the format reserves', () => {
  assert.equal(
    QrPayload.wifi({ ssid: 'a;b,c:d\\e', password: 'p;q,r:s' }),
    'WIFI:T:WPA;S:a\\;b\\,c\\:d\\\\e;P:p\\;q\\,r\\:s;;',
  );
});

test('wifi marks a hidden network', () => {
  assert.equal(QrPayload.wifi({ ssid: 'H', password: 'x', hidden: true }), 'WIFI:T:WPA;S:H;P:x;H:true;;');
});

test('vCard carries the fields a phone imports', () => {
  const card = QrPayload.vCard({
    firstName: 'J',
    lastName: 'AP',
    displayName: 'J.AP',
    organization: 'japofc',
    title: 'Developer',
    phone: '+6281234567890',
    email: 'hi@example.com',
    website: 'https://github.com/JAPofc',
    address: 'Medan',
  });

  assert.match(card, /^BEGIN:VCARD\r\n/);
  assert.match(card, /\r\nEND:VCARD\r\n$/);
  assert.match(card, /\r\nVERSION:3\.0\r\n/);
  assert.match(card, /\r\nN:AP;J;;;\r\n/);
  assert.match(card, /\r\nFN:J\.AP\r\n/);
  assert.match(card, /\r\nORG:japofc\r\n/);
  assert.match(card, /\r\nTEL;TYPE=CELL:\+6281234567890\r\n/);
  assert.match(card, /\r\nEMAIL;TYPE=INTERNET:hi@example\.com\r\n/);
});

test('vCard escapes separators in values', () => {
  const card = QrPayload.vCard({ firstName: 'a;b,c', lastName: 'd\\e' });

  assert.match(card, /\r\nN:d\\\\e;a\\;b\\,c;;;\r\n/);
});

test('vCard folds long lines to 75 octets', () => {
  const card = QrPayload.vCard({ firstName: 'x'.repeat(120) });
  const lines = card.split('\r\n');
  const index = lines.findIndex((line) => line.startsWith('N:'));
  const firstLine = lines[index];
  const continuation = lines[index + 1];

  assert.ok(firstLine.length <= 75, `folded line is ${firstLine.length} long`);
  assert.ok(continuation.startsWith(' '), 'continuation must start with a space');
  assert.equal((firstLine + continuation.slice(1)).length, 2 + 1 + 120 + 3);
});

test('MECARD keeps the compact syntax', () => {
  const card = QrPayload.mecard({ lastName: 'AP', firstName: 'J', phone: '123', email: 'a@b.c' });

  assert.equal(card, 'MECARD:N:AP,J;TEL:123;EMAIL:a@b.c;;');
});

test('event writes a calendar the phone can import', () => {
  const event = QrPayload.event({
    summary: 'Meetup',
    start: '20261201T090000Z',
    end: '20261201T110000Z',
    location: 'Medan',
  });

  assert.match(event, /^BEGIN:VCALENDAR\r\n/);
  assert.match(event, /\r\nBEGIN:VEVENT\r\n/);
  assert.match(event, /\r\nDTSTART:20261201T090000Z\r\n/);
  assert.match(event, /\r\nDTEND:20261201T110000Z\r\n/);
  assert.match(event, /\r\nSUMMARY:Meetup\r\n/);
  assert.match(event, /\r\nLOCATION:Medan\r\n/);
  assert.match(event, /\r\nEND:VCALENDAR\r\n$/);
});

test('event formats a Date as a UTC timestamp', () => {
  const event = QrPayload.event({
    summary: 'x',
    start: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)),
    end: new Date(Date.UTC(2026, 0, 2, 4, 0, 0)),
  });

  assert.match(event, /\r\nDTSTART:20260102T030405Z\r\n/);
});

test('geo writes the coordinates and optional query', () => {
  assert.equal(QrPayload.geo({ latitude: 3.5952, longitude: 98.6722 }), 'geo:3.5952,98.6722');
  assert.equal(
    QrPayload.geo({ latitude: 3.5952, longitude: 98.6722, query: 'Medan, ID' }),
    'geo:3.5952,98.6722?q=Medan%2C%20ID',
  );
});

test('sms, email and tel build their schemes', () => {
  assert.equal(QrPayload.sms({ phone: '123' }), 'SMSTO:123');
  assert.equal(QrPayload.sms({ phone: '123', body: 'hi' }), 'SMSTO:123:hi');
  assert.equal(QrPayload.email({ to: 'a@b.c' }), 'mailto:a@b.c');
  assert.equal(
    QrPayload.email({ to: 'a@b.c', subject: 'Hi', body: 'there' }),
    'mailto:a@b.c?subject=Hi&body=there',
  );
  assert.equal(QrPayload.tel('+628123'), 'tel:+628123');
});

test('whatsapp strips formatting and encodes the message', () => {
  assert.equal(
    QrPayload.whatsapp({ phone: '+62 812-3456-7890', message: 'Halo, saya mau pesan' }),
    'https://wa.me/6281234567890?text=Halo%2C%20saya%20mau%20pesan',
  );
  assert.equal(QrPayload.whatsapp({ phone: '628123' }), 'https://wa.me/628123');
});

test('whatsapp rejects a number with no digits', () => {
  assert.throws(() => QrPayload.whatsapp({ phone: 'abc' }), RangeError);
});

test('every payload encodes into a QR code', () => {
  const payloads = [
    QrPayload.wifi({ ssid: 'Cafe', password: 'secret' }),
    QrPayload.vCard({ firstName: 'J', lastName: 'AP' }),
    QrPayload.mecard({ lastName: 'AP', firstName: 'J' }),
    QrPayload.event({ summary: 'Meetup', start: '20261201T090000Z', end: '20261201T110000Z' }),
    QrPayload.geo({ latitude: 3.5, longitude: 98.6 }),
    QrPayload.sms({ phone: '123', body: 'hi' }),
    QrPayload.email({ to: 'a@b.c', subject: 'Hi' }),
    QrPayload.tel('+628123'),
    QrPayload.whatsapp({ phone: '628123', message: 'hi' }),
  ];

  for (const payload of payloads) {
    const qr = QrCode.encodeText(payload, { ecc: 'high' });
    assert.ok(qr.size >= 21, `${payload.slice(0, 20)} did not encode`);
  }
});
