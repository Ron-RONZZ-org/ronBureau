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
import { IsString, IsUrl, IsOptional, validateOrReject } from 'class-validator';

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

@Controller('caldav')
@UseGuards(JwtAuthGuard)
export class CalDavController {
  @Post('proxy')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async proxyFetch(@Body() body: ProxyRequestDto): Promise<string> {
    const dto = Object.assign(new ProxyRequestDto(), body);
    try {
      await validateOrReject(dto);
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

    return response.text();
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
