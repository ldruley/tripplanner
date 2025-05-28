import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from "@nestjs/common";
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  }

  /**
   * Validates the JWT token from the request header.
   * @param context The execution context containing the request.
   * @returns A boolean indicating whether the request is authorized.
   * @throws UnauthorizedException if the token is missing or invalid.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (request.method === 'OPTIONS') {
        return true;
      }

    const token = this.extractTokenFromHeader(request);
    this.logger.debug(`Incoming request: ${request.method} ${request.url}`);
    this.logger.debug(`Request headers: ${JSON.stringify(request.headers)}`);

    this.logger.debug(`Authorization header: ${request.headers.authorization}`);
    this.logger.debug(`Extracted token: ${token ? 'present' : 'missing'}`);

    if (!token) {
      this.logger.warn('No token provided in Authorization header');
      throw new UnauthorizedException('No token provided');
    }

    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error) {
        this.logger.warn(`Supabase auth error: ${error.message}`);
        throw new UnauthorizedException('Invalid token');
      }

      if (!user) {
        this.logger.warn('No user found for the provided token');
        throw new UnauthorizedException('Invalid token');
      }

      this.logger.debug(`User authenticated: ${user.id}`);
      request.user = user;
      return true;
    } catch (error: any) {
      this.logger.error(`Authentication failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Extracts the JWT token from the Authorization header.
   * @param request The HTTP request object.
   * @returns The JWT token if present, otherwise undefined.
   */
  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      this.logger.debug('No authorization header found');
      return undefined;
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer') {
      this.logger.debug(`Invalid authorization type: ${type}`);
      return undefined;
    }

    if (!token) {
      this.logger.debug('No token found after Bearer');
      return undefined;
    }

    return token;
  }
}
