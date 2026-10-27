import { Controller, UseGuards, Delete, Get, HttpCode, Patch, Post, Put, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { Auth } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { zodBodySchema } from '../common/openapi'
import { profilePutBodySchema } from './handlers/profile.put'
import { publicationsPostBodySchema } from './handlers/publications.post'
import { publicationsPreviewPostBodySchema } from './handlers/publications-preview.post'
import { reportsPostBodySchema } from './handlers/reports.post'
import { publicationsIdPatchBodySchema } from './handlers/publications-id.patch'
import { tripsSlugCommentsPostBodySchema } from './handlers/trips-slug-comments.post'
import { CommunityService } from './community.service'
import { CommunityEnabledGuard } from './community-enabled.guard'

@ApiTags("community")
@Controller()
@UseGuards(CommunityEnabledGuard)
export class CommunityController {
  constructor(private readonly service: CommunityService) {}

  @Get("api/community/creators")
  @ApiOperation({ summary: "Creators with the most followers and public trips, for the /community sidebar" })
  creatorsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.creatorsGet(toEvent(req, res)))
  }

  @Get("api/community/destinations")
  @ApiOperation({ summary: "Destinations with the most public community trips" })
  destinationsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.destinationsGet(toEvent(req, res)))
  }

  @Get("api/community/follow-state")
  @ApiOperation({ summary: "Which of the given handles the visitor follows. Signed-out visitors get an empty list." })
  followStateGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.followStateGet(toEvent(req, res)))
  }

  @Get("api/community/profile")
  @ApiOperation({ summary: "The signed-in user's public profile, or a suggested handle and name to start one" })
  @Auth()
  profileGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.profileGet(toEvent(req, res)))
  }

  @Put("api/community/profile")
  @HttpCode(200)
  @ApiOperation({ summary: "PUT /api/community/profile" })
  @ApiBody({ schema: zodBodySchema(profilePutBodySchema) })
  @Auth()
  profilePut(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.profilePut(toEvent(req, res)))
  }

  @Post("api/community/publications")
  @HttpCode(200)
  @ApiOperation({ summary: "Publish one of your trips, or republish it after editing the private trip" })
  @ApiBody({ schema: zodBodySchema(publicationsPostBodySchema) })
  @Auth()
  publicationsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.publicationsPost(toEvent(req, res)))
  }

  @Post("api/community/publications/preview")
  @HttpCode(200)
  @ApiOperation({ summary: "What publishing one of your trips would make public. Saves nothing." })
  @ApiBody({ schema: zodBodySchema(publicationsPreviewPostBodySchema) })
  @Auth()
  publicationsPreviewPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.publicationsPreviewPost(toEvent(req, res)))
  }

  @Post("api/community/reports")
  @HttpCode(200)
  @ApiOperation({ summary: "Report a trip, comment or profile to the moderators" })
  @ApiBody({ schema: zodBodySchema(reportsPostBodySchema) })
  @Auth()
  reportsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.reportsPost(toEvent(req, res)))
  }

  @Get("api/community/saved")
  @ApiOperation({ summary: "The signed-in user's saved trips, newest first. Cursor: the last save's timestamp." })
  @Auth()
  savedGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.savedGet(toEvent(req, res)))
  }

  @Get("api/community/saved/state")
  @ApiOperation({ summary: "Which of the given trip ids the visitor has saved. Signed-out visitors get an empty list." })
  savedStateGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.savedStateGet(toEvent(req, res)))
  }

  @Get("api/community/trips")
  @ApiOperation({ summary: "Discovery list for /community and the home page. Public trips only, so it can be cached briefly." })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  tripsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.tripsGet(toEvent(req, res)))
  }

  @Delete("api/community/comments/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Delete your own comment (admins can delete any)" })
  @ApiParam({ name: "id" })
  @Auth()
  commentsIdDelete(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.commentsIdDelete(toEvent(req, res)))
  }

  @Patch("api/community/comments/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Edit your own comment" })
  @ApiParam({ name: "id" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"body": {}}} })
  @Auth()
  commentsIdPatch(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.commentsIdPatch(toEvent(req, res)))
  }

  @Get("api/community/profiles/:handle")
  @ApiOperation({ summary: "A public traveler profile with its first page of public trips. No viewer state, so it can be cached briefly." })
  @ApiParam({ name: "handle" })
  profilesHandleGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.profilesHandleGet(toEvent(req, res)))
  }

  @Delete("api/community/profiles/:handle/follow")
  @HttpCode(200)
  @ApiOperation({ summary: "Stop following a traveler. Idempotent." })
  @ApiParam({ name: "handle" })
  @Auth()
  profilesHandleFollowDelete(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.profilesHandleFollowDelete(toEvent(req, res)))
  }

  @Put("api/community/profiles/:handle/follow")
  @HttpCode(200)
  @ApiOperation({ summary: "Follow a traveler. Idempotent; you cannot follow yourself." })
  @ApiParam({ name: "handle" })
  @Auth()
  profilesHandleFollowPut(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.profilesHandleFollowPut(toEvent(req, res)))
  }

  @Get("api/community/profiles/:handle/trips")
  @ApiOperation({ summary: "More public trips by a traveler (cursor pagination)" })
  @ApiParam({ name: "handle" })
  profilesHandleTripsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.profilesHandleTripsGet(toEvent(req, res)))
  }

  @Delete("api/community/publications/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Take your trip off the community. Your private trip stays in My trips." })
  @ApiParam({ name: "id" })
  @Auth()
  publicationsIdDelete(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.publicationsIdDelete(toEvent(req, res)))
  }

  @Patch("api/community/publications/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Change who can see your published trip" })
  @ApiParam({ name: "id" })
  @ApiBody({ schema: zodBodySchema(publicationsIdPatchBodySchema) })
  @Auth()
  publicationsIdPatch(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.publicationsIdPatch(toEvent(req, res)))
  }

  @Get("api/community/trips/:slug")
  @ApiOperation({ summary: "A published trip with live prices for its activities. Answers depend on who asks" })
  @ApiParam({ name: "slug" })
  tripsSlugGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.tripsSlugGet(toEvent(req, res)))
  }

  @Get("api/community/trips/:slug/booking-options")
  @ApiOperation({ summary: "Bookable activities for a published trip's destination, with live supplier prices." })
  @ApiParam({ name: "slug" })
  tripsSlugBookingOptionsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.tripsSlugBookingOptionsGet(toEvent(req, res)))
  }

  @Get("api/community/trips/:slug/comments")
  @ApiOperation({ summary: "Comments on a public or unlisted trip, newest first. Marks the viewer's own comments, so never cached." })
  @ApiParam({ name: "slug" })
  tripsSlugCommentsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.tripsSlugCommentsGet(toEvent(req, res)))
  }

  @Post("api/community/trips/:slug/comments")
  @HttpCode(200)
  @ApiOperation({ summary: "Post a comment (needs a traveler profile). Limited per IP here and per user in the service." })
  @ApiParam({ name: "slug" })
  @ApiBody({ schema: zodBodySchema(tripsSlugCommentsPostBodySchema) })
  @Auth()
  tripsSlugCommentsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.tripsSlugCommentsPost(toEvent(req, res)))
  }

  @Delete("api/community/trips/:slug/save")
  @HttpCode(200)
  @ApiOperation({ summary: "Remove a saved trip. Removing one that was not saved is a no-op." })
  @ApiParam({ name: "slug" })
  @Auth()
  tripsSlugSaveDelete(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.tripsSlugSaveDelete(toEvent(req, res)))
  }

  @Put("api/community/trips/:slug/save")
  @HttpCode(200)
  @ApiOperation({ summary: "Save a community trip. Idempotent: saving twice keeps one save." })
  @ApiParam({ name: "slug" })
  @Auth()
  tripsSlugSavePut(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.tripsSlugSavePut(toEvent(req, res)))
  }
}
