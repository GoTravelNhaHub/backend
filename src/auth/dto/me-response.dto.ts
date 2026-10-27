import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class UserDto {
  @ApiProperty({ format: 'uuid' }) id: string
  @ApiProperty() username: string
  @ApiProperty() email: string
  @ApiPropertyOptional({ nullable: true }) firstName: string | null
  @ApiPropertyOptional({ nullable: true }) lastName: string | null
  @ApiProperty({ enum: ['ADMIN', 'USER'] }) role: 'ADMIN' | 'USER'
  @ApiProperty() isActive: boolean
  @ApiProperty() createdAt: Date
  @ApiProperty() updatedAt: Date
}

export class MeResponseDto {
  @ApiProperty() success: boolean
  @ApiProperty({ type: UserDto }) user: UserDto
  @ApiProperty({ enum: ['ADMIN', 'USER'] }) role: 'ADMIN' | 'USER'
}
