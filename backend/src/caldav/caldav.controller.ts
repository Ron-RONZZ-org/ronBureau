import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Header,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsString, IsUrl, IsOptional, IsIn, validateOrReject } from 'class-validator';

interface DiscoveredCalendar {
  href: string;
  name: string;
  color: string | null;
}

class ProxyRequestDto {
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  url: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

class DiscoverRequestDto {
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  url: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

class ProxyWriteDto {
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  url: string;

  @IsIn(['PUT', 'DELETE'])
  method: 'PUT' | 'DELETE';

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

@Controller('caldav')
@UseGuards(JwtAuthGuard)
export class CalDavController {
  @Post('proxy')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async proxyFetch(@Body() dto: ProxyRequestDto): Promise<string> {
    const dtoObj = Object.assign(new ProxyRequestDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    let parsed: URL;
    try {
      parsed = new URL(dto.url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http and https URLs are supported');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (this.isPrivateHost(hostname)) {
      throw new BadRequestException('Requests to private network addresses are not allowed');
    }

    const headers: Record<string, string> = {
      Accept: 'text/calendar,application/ics,*/*',
    };
    if (dto.username && dto.password) {
      headers['Authorization'] =
        'Basic ' + Buffer.from(`${dto.username}:${dto.password}`).toString('base64');
    }

    let response: globalThis.Response;
    try {
      response = await fetch(parsed.toString(), { headers });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to fetch calendar: ${msg}`);
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Remote server responded with ${response.status} ${response.statusText}`,
      );
    }

    const icsBody = await response.text();

    // If the response is valid ICS, return it directly
    if (icsBody.includes('BEGIN:VCALENDAR')) {
      return icsBody;
    }

    // Fallback 1: append ?export (Nextcloud / ownCloud pattern)
    const exportUrl = parsed.href.includes('?')
      ? `${parsed.href}&export`
      : `${parsed.href}?export`;
    try {
      const exportRes = await fetch(exportUrl, { headers });
      if (exportRes.ok) {
        const exportBody = await exportRes.text();
        if (exportBody.includes('BEGIN:VCALENDAR')) {
          return exportBody;
        }
      }
    } catch { /* ignore */ }

    // Fallback 2: CalDAV calendar-query REPORT (standard CalDAV protocol)
    const reportBody = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-data/></D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT"/>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;
    try {
      const reportRes = await fetch(parsed.href, {
        method: 'REPORT',
        headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
        body: reportBody,
      });
      if (reportRes.ok) {
        const xmlText = await reportRes.text();
        const veventBlocks: string[] = [];
        // Parse per <D:response> block to correlate href with each VEVENT
        const responseRe = /<D:response>([\s\S]*?)<\/D:response>/gi;
        let responseMatch: RegExpExecArray | null;
        while ((responseMatch = responseRe.exec(xmlText)) !== null) {
          const responseBlock = responseMatch[1];
          const hrefMatch = /<D:href>(.*?)<\/D:href>/i.exec(responseBlock);
          const href = hrefMatch ? hrefMatch[1].trim() : null;
          const fullHref = href
            ? (href.startsWith('http') ? href : `${parsed.protocol}//${parsed.host}${href}`)
            : null;
          const veRe = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g;
          let m: RegExpExecArray | null;
          while ((m = veRe.exec(responseBlock)) !== null) {
            let vevent = this.unescapeXml(m[0]);
            if (fullHref) {
              vevent = vevent.replace('END:VEVENT', `X-CALDAV-URL:${fullHref}\r\nEND:VEVENT`);
            }
            veventBlocks.push(vevent);
          }
        }
        // Fallback: no <D:response> wrappers, extract VEVENTs directly
        if (veventBlocks.length === 0) {
          const re = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(xmlText)) !== null) {
            veventBlocks.push(this.unescapeXml(m[0]));
          }
        }
        if (veventBlocks.length > 0) {
          return [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//RonBureau//CalDAV Proxy//EN',
            ...veventBlocks,
            'END:VCALENDAR',
          ].join('\r\n');
        }
      }
    } catch { /* ignore */ }

    throw new InternalServerErrorException(
      'The URL did not return a valid iCalendar file. ' +
        'For Nextcloud/ownCloud, try appending "?export" to the URL.',
    );
  }

  @Post('write')
  async proxyWrite(@Body() dto: ProxyWriteDto): Promise<{ status: number; statusText: string }> {
    const dtoObj = Object.assign(new ProxyWriteDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    let parsed: URL;
    try {
      parsed = new URL(dto.url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http and https URLs are supported');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (this.isPrivateHost(hostname)) {
      throw new BadRequestException('Requests to private network addresses are not allowed');
    }

    const headers: Record<string, string> = {};
    if (dto.username && dto.password) {
      headers['Authorization'] =
        'Basic ' + Buffer.from(`${dto.username}:${dto.password}`).toString('base64');
    }
    if (dto.method === 'PUT') {
      headers['Content-Type'] = 'text/calendar; charset=utf-8';
    }

    let response: globalThis.Response;
    try {
      response = await fetch(parsed.toString(), {
        method: dto.method,
        headers,
        ...(dto.method === 'PUT' && dto.body ? { body: dto.body } : {}),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`CalDAV write failed: ${msg}`);
    }

    if (!response.ok && response.status !== 204) {
      throw new InternalServerErrorException(
        `Remote server responded with ${response.status} ${response.statusText}`,
      );
    }

    return { status: response.status, statusText: response.statusText };
  }

  @Post('discover')
  async discoverCalendars(@Body() dto: DiscoverRequestDto): Promise<DiscoveredCalendar[]> {
    const dtoObj = Object.assign(new DiscoverRequestDto(), dto);
    try {
      await validateOrReject(dtoObj);
    } catch {
      throw new BadRequestException('Invalid request parameters');
    }

    let parsed: URL;
    try {
      parsed = new URL(dto.url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http and https URLs are supported');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (this.isPrivateHost(hostname)) {
      throw new BadRequestException('Requests to private network addresses are not allowed');
    }

    const authHeaders: Record<string, string> = {};
    if (dto.username && dto.password) {
      authHeaders['Authorization'] =
        'Basic ' + Buffer.from(`${dto.username}:${dto.password}`).toString('base64');
    }

    // Strategy 1: PROPFIND Depth:1 on the given URL to find calendar collections
    const calendars = await this.propfindCalendars(parsed.href, authHeaders);
    if (calendars.length > 0) return calendars;

    // Strategy 2: Discover via well-known → current-user-principal → calendar-home-set
    try {
      const wellKnownUrl = `${parsed.protocol}//${parsed.host}/.well-known/caldav`;
      let principalUrl = await this.resolvePrincipalUrl(wellKnownUrl, authHeaders, parsed);
      if (!principalUrl) {
        principalUrl = await this.resolvePrincipalUrl(parsed.href, authHeaders, parsed);
      }
      if (principalUrl) {
        const homeUrl = await this.resolveCalendarHomeSet(principalUrl, authHeaders, parsed);
        if (homeUrl) {
          const discovered = await this.propfindCalendars(homeUrl, authHeaders);
          if (discovered.length > 0) return discovered;
        }
      }
    } catch { /* ignore discovery errors */ }

    // Strategy 3: Fallback — treat the given URL as a single calendar
    return [{ href: dto.url, name: 'Calendar', color: null }];
  }

  private async propfindCalendars(
    url: string,
    headers: Record<string, string>,
  ): Promise<DiscoveredCalendar[]> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/" xmlns:ICAL="http://apple.com/ns/ical/">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
    <ICAL:calendar-color/>
    <CS:getctag/>
  </D:prop>
</D:propfind>`;
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        method: 'PROPFIND',
        headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
        body,
      });
    } catch {
      return [];
    }
    if (!response.ok) return [];
    const xml = await response.text();
    return this.parseCalendarCollections(xml, url);
  }

  private parseCalendarCollections(xml: string, baseUrl: string): DiscoveredCalendar[] {
    const parsed = new URL(baseUrl);
    const results: DiscoveredCalendar[] = [];
    const responseRe = /<[^:>]*:?response[^>]*>([\s\S]*?)<\/[^:>]*:?response>/gi;
    let m: RegExpExecArray | null;
    while ((m = responseRe.exec(xml)) !== null) {
      const block = m[1];
      // Only include resources whose <resourcetype> contains a calendar element.
      // We extract the resourcetype block first to avoid false-positives from
      // property tags like <x1:calendar-color .../> that appear in 404 propstat blocks.
      const rtMatch = /<[^:>]*:?resourcetype[^>]*>([\s\S]*?)<\/[^:>]*:?resourcetype>/i.exec(block);
      if (!rtMatch || !/<[^:>]*:?calendar[\s/>]/i.test(rtMatch[1])) continue;
      const hrefMatch = /<[^:>]*:?href[^>]*>(.*?)<\/[^:>]*:?href>/i.exec(block);
      if (!hrefMatch) continue;
      const href = hrefMatch[1].trim();
      const fullHref = href.startsWith('http') ? href : `${parsed.protocol}//${parsed.host}${href}`;
      const nameMatch = /<[^:>]*:?displayname[^>]*>(.*?)<\/[^:>]*:?displayname>/i.exec(block);
      const name = nameMatch ? this.unescapeXml(nameMatch[1].trim()) : 'Calendar';
      const colorMatch = /<[^:>]*:?calendar-color[^>]*>(.*?)<\/[^:>]*:?calendar-color>/i.exec(block);
      const color = colorMatch ? this.unescapeXml(colorMatch[1].trim()).replace(/FF$/i, '') : null;
      results.push({ href: fullHref, name: name || 'Calendar', color });
    }
    return results;
  }

  private async resolvePrincipalUrl(
    url: string,
    headers: Record<string, string>,
    base: URL,
  ): Promise<string | null> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:"><D:prop><D:current-user-principal/></D:prop></D:propfind>`;
    try {
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', Depth: '0' },
        body,
      });
      if (!response.ok) return null;
      const xml = await response.text();
      const match = /<[^:>]*:?current-user-principal[^>]*>[\s\S]*?<[^:>]*:?href[^>]*>(.*?)<\/[^:>]*:?href>/i.exec(xml);
      if (!match) return null;
      const href = match[1].trim();
      return href.startsWith('http') ? href : `${base.protocol}//${base.host}${href}`;
    } catch {
      return null;
    }
  }

  private async resolveCalendarHomeSet(
    principalUrl: string,
    headers: Record<string, string>,
    base: URL,
  ): Promise<string | null> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-home-set/></D:prop>
</D:propfind>`;
    try {
      const response = await fetch(principalUrl, {
        method: 'PROPFIND',
        headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', Depth: '0' },
        body,
      });
      if (!response.ok) return null;
      const xml = await response.text();
      const match = /<[^:>]*:?calendar-home-set[^>]*>[\s\S]*?<[^:>]*:?href[^>]*>(.*?)<\/[^:>]*:?href>/i.exec(xml);
      if (!match) return null;
      const href = match[1].trim();
      return href.startsWith('http') ? href : `${base.protocol}//${base.host}${href}`;
    } catch {
      return null;
    }
  }

  private unescapeXml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  private isPrivateHost(hostname: string): boolean {
    return (
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      // IPv4 loopback
      hostname === '127.0.0.1' ||
      /^127\./.test(hostname) ||
      // IPv4 private ranges
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      // IPv4 link-local
      /^169\.254\./.test(hostname) ||
      // IPv6 loopback and link-local
      hostname === '::1' ||
      hostname === '[::1]' ||
      /^fe80:/i.test(hostname) ||
      /^\[fe80:/i.test(hostname) ||
      // IPv6 private (fc00::/7)
      /^f[cd][0-9a-f]{2}:/i.test(hostname) ||
      /^\[f[cd][0-9a-f]{2}:/i.test(hostname)
    );
  }
}
