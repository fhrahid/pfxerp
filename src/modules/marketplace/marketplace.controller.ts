import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { MarketplaceService } from './marketplace.service';

class CreateListingDto {
  @IsString()
  @MinLength(5)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  price: number;

  @IsOptional()
  @IsString()
  repositoryUrl?: string;
}

class PurchaseDto {
  @IsUUID()
  buyerSquadId: string;
}

@ApiTags('marketplace')
@ApiBearerAuth()
@Controller('cto/marketplace/listings')
export class MarketplaceController {
  constructor(private readonly market: MarketplaceService) {}

  /** API-CTO-16 (guard: MARKETPLACE_AUTHOR certification). */
  @Post()
  create(@Body() dto: CreateListingDto, @CurrentUser() user: AuthUser) {
    return this.market.createListing(user, dto);
  }

  /** API-CTO-17. */
  @Get()
  list(@Query('query') query?: string, @Query('maxPrice') maxPrice?: string) {
    return this.market.listListings({
      query,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    });
  }

  /** API-CTO-18. */
  @Post(':id/purchase')
  @Roles(UserRole.PM, UserRole.CTO)
  purchase(
    @Param('id') id: string,
    @Body() dto: PurchaseDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-idempotency-key') idem?: string,
  ) {
    return this.market.purchase(user, id, dto.buyerSquadId, idem || '');
  }

  @Post(':id/verify')
  @Roles(UserRole.CTO)
  verify(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.market.verifyListing(user.id, id);
  }

  /** API-CTO-19. */
  @Post(':id/delist')
  @Roles(UserRole.CTO)
  delist(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.market.delist(id, body.reason);
  }
}
