import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { creatorsGet } from './handlers/creators.get'
import { destinationsGet } from './handlers/destinations.get'
import { followStateGet } from './handlers/follow-state.get'
import { profileGet } from './handlers/profile.get'
import { profilePut } from './handlers/profile.put'
import { publicationsPost } from './handlers/publications.post'
import { publicationsPreviewPost } from './handlers/publications-preview.post'
import { reportsPost } from './handlers/reports.post'
import { savedGet } from './handlers/saved.get'
import { savedStateGet } from './handlers/saved-state.get'
import { tripsGet } from './handlers/trips.get'
import { commentsIdDelete } from './handlers/comments-id.delete'
import { commentsIdPatch } from './handlers/comments-id.patch'
import { profilesHandleGet } from './handlers/profiles-handle.get'
import { profilesHandleFollowDelete } from './handlers/profiles-handle-follow.delete'
import { profilesHandleFollowPut } from './handlers/profiles-handle-follow.put'
import { profilesHandleTripsGet } from './handlers/profiles-handle-trips.get'
import { publicationsIdDelete } from './handlers/publications-id.delete'
import { publicationsIdPatch } from './handlers/publications-id.patch'
import { tripsSlugGet } from './handlers/trips-slug.get'
import { tripsSlugBookingOptionsGet } from './handlers/trips-slug-booking-options.get'
import { tripsSlugCommentsGet } from './handlers/trips-slug-comments.get'
import { tripsSlugCommentsPost } from './handlers/trips-slug-comments.post'
import { tripsSlugSaveDelete } from './handlers/trips-slug-save.delete'
import { tripsSlugSavePut } from './handlers/trips-slug-save.put'

/** community use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class CommunityService {
  creatorsGet(event: HttpEvent) {
    return creatorsGet(event)
  }

  destinationsGet(event: HttpEvent) {
    return destinationsGet(event)
  }

  followStateGet(event: HttpEvent) {
    return followStateGet(event)
  }

  profileGet(event: HttpEvent) {
    return profileGet(event)
  }

  profilePut(event: HttpEvent) {
    return profilePut(event)
  }

  publicationsPost(event: HttpEvent) {
    return publicationsPost(event)
  }

  publicationsPreviewPost(event: HttpEvent) {
    return publicationsPreviewPost(event)
  }

  reportsPost(event: HttpEvent) {
    return reportsPost(event)
  }

  savedGet(event: HttpEvent) {
    return savedGet(event)
  }

  savedStateGet(event: HttpEvent) {
    return savedStateGet(event)
  }

  tripsGet(event: HttpEvent) {
    return tripsGet(event)
  }

  commentsIdDelete(event: HttpEvent) {
    return commentsIdDelete(event)
  }

  commentsIdPatch(event: HttpEvent) {
    return commentsIdPatch(event)
  }

  profilesHandleGet(event: HttpEvent) {
    return profilesHandleGet(event)
  }

  profilesHandleFollowDelete(event: HttpEvent) {
    return profilesHandleFollowDelete(event)
  }

  profilesHandleFollowPut(event: HttpEvent) {
    return profilesHandleFollowPut(event)
  }

  profilesHandleTripsGet(event: HttpEvent) {
    return profilesHandleTripsGet(event)
  }

  publicationsIdDelete(event: HttpEvent) {
    return publicationsIdDelete(event)
  }

  publicationsIdPatch(event: HttpEvent) {
    return publicationsIdPatch(event)
  }

  tripsSlugGet(event: HttpEvent) {
    return tripsSlugGet(event)
  }

  tripsSlugBookingOptionsGet(event: HttpEvent) {
    return tripsSlugBookingOptionsGet(event)
  }

  tripsSlugCommentsGet(event: HttpEvent) {
    return tripsSlugCommentsGet(event)
  }

  tripsSlugCommentsPost(event: HttpEvent) {
    return tripsSlugCommentsPost(event)
  }

  tripsSlugSaveDelete(event: HttpEvent) {
    return tripsSlugSaveDelete(event)
  }

  tripsSlugSavePut(event: HttpEvent) {
    return tripsSlugSavePut(event)
  }
}
