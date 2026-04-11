import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import type { RefreshTokenPayload } from '@en/common/user';

//守卫 用于保护路由
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest(); //读取req
    const headers = request.headers; //读取请求头
    // 未走前端，直接调用的接口
    if (!headers.authorization) {
      throw new UnauthorizedException('你是偷子???'); //401
    }
    // 切割前缀-比如Bearer，获取有效token
    const token = headers.authorization.split(' ')[1];
    try {
      // 验证Token
      const decoded = this.jwtService.verify<RefreshTokenPayload>(token);
      if (decoded.tokenType !== 'access') {
        throw new UnauthorizedException('token已过期或无效'); //401
      }
      request.user = decoded; //payload 存储到自定义属性当中
      return true;
    } catch (error) {
      throw new UnauthorizedException('token已过期或无效'); //401
    }
  }
}
