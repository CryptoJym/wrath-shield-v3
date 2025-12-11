/**
 * Google Calendar Client
 * Integration with Google Calendar API via googleapis package
 *
 * Setup Required:
 * 1. Create Google Cloud Project
 * 2. Enable Google Calendar API
 * 3. Create OAuth 2.0 credentials or Service Account
 * 4. Set environment variables:
 *    - GOOGLE_CLIENT_ID
 *    - GOOGLE_CLIENT_SECRET
 *    - GOOGLE_REFRESH_TOKEN (for OAuth)
 *    OR
 *    - GOOGLE_SERVICE_ACCOUNT_JSON (for service account)
 *    - DEFAULT_TIMEZONE (optional, defaults to 'America/Los_Angeles')
 *
 * Documentation:
 * - https://developers.google.com/calendar/api/v3/reference
 * - https://github.com/googleapis/google-api-nodejs-client
 */

import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: string[];
  status?: 'confirmed' | 'tentative' | 'cancelled';
  recurring?: boolean;
  calendarId?: string;
}

export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar | null = null;
  private auth: OAuth2Client | null = null;
  private timeZone: string;

  constructor(timeZone?: string) {
    // Fallback chain: parameter → env var → default
    this.timeZone = timeZone || process.env.DEFAULT_TIMEZONE || 'America/Los_Angeles';
    this.initializeAuth();
  }

  /**
   * Initialize Google OAuth2 authentication
   */
  private initializeAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
      console.warn('[GoogleCalendar] OAuth credentials not configured');
      return;
    }

    this.auth = new google.auth.OAuth2(clientId, clientSecret);

    if (refreshToken) {
      this.auth.setCredentials({
        refresh_token: refreshToken,
      });

      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
      console.log('[GoogleCalendar] Initialized with OAuth2');
    } else {
      console.warn('[GoogleCalendar] Refresh token not configured');
    }
  }

  /**
   * Check if calendar client is ready
   */
  isReady(): boolean {
    return this.calendar !== null;
  }

  /**
   * Get upcoming events from primary calendar
   */
  async getUpcomingEvents(
    maxResults: number = 10,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      throw new Error('Google Calendar not configured');
    }

    const response = await this.calendar.events.list({
      calendarId,
      timeMin: new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    return events.map(this.mapGoogleEventToCalendarEvent);
  }

  /**
   * Get events in a specific time range
   */
  async getEventsInRange(
    start: Date,
    end: Date,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      throw new Error('Google Calendar not configured');
    }

    const response = await this.calendar.events.list({
      calendarId,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    return events.map(this.mapGoogleEventToCalendarEvent);
  }

  /**
   * Create a new calendar event
   */
  async createEvent(
    event: Omit<CalendarEvent, 'id'>,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    if (!this.calendar) {
      throw new Error('Google Calendar not configured');
    }

    const googleEvent: calendar_v3.Schema$Event = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: this.timeZone,
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: this.timeZone,
      },
      attendees: event.attendees?.map(email => ({ email })),
      status: event.status || 'confirmed',
    };

    const response = await this.calendar.events.insert({
      calendarId,
      requestBody: googleEvent,
    });

    return this.mapGoogleEventToCalendarEvent(response.data);
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CalendarEvent>,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    if (!this.calendar) {
      throw new Error('Google Calendar not configured');
    }

    const googleEvent: calendar_v3.Schema$Event = {};

    if (updates.title) googleEvent.summary = updates.title;
    if (updates.description) googleEvent.description = updates.description;
    if (updates.location) googleEvent.location = updates.location;
    if (updates.start) {
      googleEvent.start = {
        dateTime: updates.start.toISOString(),
        timeZone: this.timeZone,
      };
    }
    if (updates.end) {
      googleEvent.end = {
        dateTime: updates.end.toISOString(),
        timeZone: this.timeZone,
      };
    }
    if (updates.attendees) {
      googleEvent.attendees = updates.attendees.map(email => ({ email }));
    }
    if (updates.status) googleEvent.status = updates.status;

    const response = await this.calendar.events.patch({
      calendarId,
      eventId,
      requestBody: googleEvent,
    });

    return this.mapGoogleEventToCalendarEvent(response.data);
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<void> {
    if (!this.calendar) {
      throw new Error('Google Calendar not configured');
    }

    await this.calendar.events.delete({
      calendarId,
      eventId,
    });
  }

  /**
   * Check for free/busy time slots
   */
  async checkFreeBusy(
    start: Date,
    end: Date,
    calendarIds: string[] = ['primary']
  ): Promise<{ calendar: string; busy: { start: Date; end: Date }[] }[]> {
    if (!this.calendar) {
      throw new Error('Google Calendar not configured');
    }

    const response = await this.calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: calendarIds.map(id => ({ id })),
      },
    });

    const calendars = response.data.calendars || {};
    return Object.entries(calendars).map(([calendarId, data]) => ({
      calendar: calendarId,
      busy: (data.busy || []).map(period => ({
        start: new Date(period.start || ''),
        end: new Date(period.end || ''),
      })),
    }));
  }

  /**
   * Find optimal meeting time slot
   */
  async findOptimalSlot(
    duration: number, // minutes
    start: Date,
    end: Date,
    calendarIds: string[] = ['primary']
  ): Promise<{ start: Date; end: Date } | null> {
    const freeBusy = await this.checkFreeBusy(start, end, calendarIds);

    // Merge all busy periods
    const allBusyPeriods = freeBusy.flatMap(cal => cal.busy);
    allBusyPeriods.sort((a, b) => a.start.getTime() - b.start.getTime());

    // Find gaps in busy periods
    let currentTime = new Date(start);
    const durationMs = duration * 60 * 1000;

    for (const busyPeriod of allBusyPeriods) {
      const gapMs = busyPeriod.start.getTime() - currentTime.getTime();

      if (gapMs >= durationMs) {
        // Found a suitable gap
        return {
          start: new Date(currentTime),
          end: new Date(currentTime.getTime() + durationMs),
        };
      }

      currentTime = new Date(Math.max(currentTime.getTime(), busyPeriod.end.getTime()));
    }

    // Check if there's time after the last busy period
    const remainingMs = end.getTime() - currentTime.getTime();
    if (remainingMs >= durationMs) {
      return {
        start: new Date(currentTime),
        end: new Date(currentTime.getTime() + durationMs),
      };
    }

    return null;
  }

  /**
   * Map Google Calendar event to our CalendarEvent interface
   */
  private mapGoogleEventToCalendarEvent(event: calendar_v3.Schema$Event): CalendarEvent {
    const start = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : event.start?.date
      ? new Date(event.start.date)
      : new Date();

    const end = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : event.end?.date
      ? new Date(event.end.date)
      : new Date();

    return {
      id: event.id || '',
      title: event.summary || 'Untitled',
      description: event.description,
      start,
      end,
      location: event.location,
      attendees: event.attendees?.map(a => a.email || '').filter(Boolean),
      status: (event.status as any) || 'confirmed',
      recurring: !!event.recurrence,
      calendarId: event.organizer?.email,
    };
  }
}

// Singleton instance
let googleCalendarClient: GoogleCalendarClient | null = null;

export function getGoogleCalendarClient(timeZone?: string): GoogleCalendarClient {
  if (!googleCalendarClient) {
    googleCalendarClient = new GoogleCalendarClient(timeZone);
  }
  return googleCalendarClient;
}
