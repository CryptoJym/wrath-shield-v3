/**
 * HYRO FORGE: SRS (Spaced Repetition System) API
 * Flashcard deck and card management
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllDecks,
  getDeck,
  createDeck,
  getDeckStats,
  getDeckCards,
  createCard,
  getDueCards,
  getTotalDueCount,
} from '@/lib/hyro/forge-srs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deckId = searchParams.get('deckId');
    const action = searchParams.get('action');

    // Get due count
    if (action === 'due-count') {
      const count = getTotalDueCount();
      return NextResponse.json({ due_count: count });
    }

    // Get due cards (optionally filtered by deck)
    if (action === 'due') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const cards = getDueCards(deckId || undefined, limit);
      return NextResponse.json({ cards, count: cards.length });
    }

    // Get specific deck
    if (deckId) {
      const deck = getDeck(deckId);
      if (!deck) {
        return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
      }

      const stats = getDeckStats(deckId);
      const cards = getDeckCards(deckId);

      return NextResponse.json({ deck, stats, cards });
    }

    // Get all decks
    const decks = getAllDecks();
    const totalDue = getTotalDueCount();

    return NextResponse.json({
      decks,
      total_due: totalDue,
    });
  } catch (error) {
    console.error('SRS GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch SRS data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Create new deck
    if (action === 'create-deck') {
      const { title, description, subject, icon } = body;
      if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
      }

      const deck = createDeck({ title, description, subject, icon });
      return NextResponse.json({ deck, message: 'Deck created successfully' });
    }

    // Create new card
    if (action === 'create-card') {
      const { deck_id, front, back, card_type, tags } = body;
      if (!deck_id || !front || !back) {
        return NextResponse.json(
          { error: 'deck_id, front, and back are required' },
          { status: 400 }
        );
      }

      const card = createCard({ deck_id, front, back, card_type, tags });
      return NextResponse.json({ card, message: 'Card created successfully' });
    }

    // Create multiple cards (batch import)
    if (action === 'import-cards') {
      const { deck_id, cards } = body;
      if (!deck_id || !Array.isArray(cards)) {
        return NextResponse.json(
          { error: 'deck_id and cards array are required' },
          { status: 400 }
        );
      }

      const { createCards } = await import('@/lib/hyro/forge-srs');
      const created = createCards(deck_id, cards);
      return NextResponse.json({
        cards: created,
        count: created.length,
        message: `Imported ${created.length} cards`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('SRS POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process SRS action' },
      { status: 500 }
    );
  }
}
