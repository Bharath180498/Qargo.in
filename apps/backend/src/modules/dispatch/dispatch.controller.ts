import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchOfferActionDto } from './dto/dispatch-offer-action.dto';

@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post('orders/:orderId/assign')
  assignOrder(@Param('orderId') orderId: string) {
    return this.dispatchService.assignOrder(orderId);
  }

  @Get('orders/:orderId/candidates')
  previewCandidates(@Param('orderId') orderId: string): Promise<unknown> {
    return this.dispatchService.previewCandidates(orderId);
  }

  @Get('orders/:orderId/decisions')
  decisions(@Param('orderId') orderId: string) {
    return this.dispatchService.getDispatchDecisions(orderId);
  }

  @Get('drivers/:driverId/offers')
  driverOffers(@Param('driverId') driverId: string) {
    return this.dispatchService.getDriverPendingOffers(driverId);
  }

  @Post('offers/:offerId/accept')
  acceptOffer(@Param('offerId') offerId: string, @Body() payload: DispatchOfferActionDto) {
    return this.dispatchService.acceptOffer(offerId, payload.driverId, payload.driverPaymentMethodId);
  }

  @Post('offers/:offerId/reject')
  rejectOffer(@Param('offerId') offerId: string, @Body() payload: DispatchOfferActionDto) {
    return this.dispatchService.rejectOffer(offerId, payload.driverId);
  }

  @Post('offers/process-expired')
  processExpired() {
    return this.dispatchService.processExpiredOffers();
  }

  @Post('scheduled/run')
  runScheduledDispatch() {
    return this.dispatchService.runScheduledDispatch();
  }
}
