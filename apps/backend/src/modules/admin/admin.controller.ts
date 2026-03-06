import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ReviewKycDto } from './dto/review-kyc.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  overview() {
    return this.adminService.overview();
  }

  @Get('analytics/trips')
  tripAnalytics() {
    return this.adminService.tripAnalytics();
  }

  @Get('analytics/heatmap')
  demandHeatmap() {
    return this.adminService.demandHeatmap();
  }

  @Get('analytics/dispatch')
  dispatchAnalytics() {
    return this.adminService.dispatchAnalytics();
  }

  @Get('fraud-alerts')
  fraudAlerts() {
    return this.adminService.fraudAlerts();
  }

  @Get('compliance')
  complianceOverview() {
    return this.adminService.complianceOverview();
  }

  @Get('kyc/pending')
  pendingKyc() {
    return this.adminService.pendingKycReview();
  }

  @Post('kyc/:verificationId/approve')
  approveKyc(@Param('verificationId') verificationId: string, @Body() payload: ReviewKycDto) {
    return this.adminService.approveKyc(
      verificationId,
      payload.adminUserId ?? 'system-admin'
    );
  }

  @Post('kyc/:verificationId/reject')
  rejectKyc(@Param('verificationId') verificationId: string, @Body() payload: ReviewKycDto) {
    return this.adminService.rejectKyc(
      verificationId,
      payload.adminUserId ?? 'system-admin',
      payload.reason ?? 'Rejected by admin review'
    );
  }
}
