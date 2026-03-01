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

class ProxyRequestDto {
  @IsUrl({ protocols: ['http', 'https'], require_tld: true })
  url: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

class ProxyWriteDto {
  @IsUrl({ protocols: ['http', 'https'], require_tld: true })
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
