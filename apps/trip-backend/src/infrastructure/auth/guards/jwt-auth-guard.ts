import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Validates the JWT token from the request header.
   * @param context The execution context containing the request.
   * @returns A boolean indicating whether the request is authorized.
   * @throws UnauthorizedException if the token is missing or invalid.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.extractTokenFromHeader(request);

    if (!token) throw new UnauthorizedException('No token provided');

    const { data: { user }, error } = await this.supabase.auth.getUser(token);

    if (error || !user) throw new UnauthorizedException('Invalid token');

    request.user = user
    return true;
  }

  /**
   * Extracts the JWT token from the Authorization header.
   * @param request The HTTP request object.
   * @returns The JWT token if present, otherwise undefined.
   */
  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
