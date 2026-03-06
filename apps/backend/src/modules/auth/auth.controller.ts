import { Body, Controller, Headers, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MockLoginDto } from './dto/mock-login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body() payload: RequestOtpDto) {
    return this.authService.requestOtp(payload);
  }

  @Post('otp/verify')
  verifyOtp(@Body() payload: VerifyOtpDto) {
    return this.authService.verifyOtp(payload);
  }

  @Post('logout')
  logout(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    return this.authService.logout(token);
  }

  @Post('mock-login')
  mockLogin(@Body() payload: MockLoginDto) {
    return this.authService.mockLogin(payload);
  }
}
