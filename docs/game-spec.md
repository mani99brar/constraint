# Constraint: game rules v1.0

Status: rules v1.0 of 2026-10-02 (operator decision). They replace the original tactical design of v0.2, with its fighters, abilities, traps, recharge and hidden objectives. The paper tests showed that the matching gate decided those games, not the fighters (`~/dev/okiya-playtests/README.md`). `paper-simulation.md` and `paper-test-01.md` document v0.2 and are kept as history only.

These are the rules of Okiya, the abstract game by Bruno Cathala, restated here in our own words. The published game is called **Constraint** and has its own tile theme and art. It uses neither the Okiya name nor its art or branding.

## 1. Components

- A 4×4 board. Rows A–D run top to bottom and columns 1–4 left to right, so cells are A1–D4. The 12 cells of the outer ring are the **edge** cells.
- 16 tiles, each showing one **terrain** (Forest, Water, Mountain, Desert) and one **symbol** (Sun, Moon, Star, Wave). There is exactly one tile for each terrain/symbol pair.
- Two players, each with 8 tokens in their colour.

Two tiles **match** when they share their terrain, their symbol or both. Every tile matches exactly six others: three share its terrain and three share its symbol.

## 2. Setup

1. Shuffle the 16 tiles and lay them face up, one per cell.
2. Choose the starting player (§5).

Nothing is hidden: both players see the whole board and every move.

## 3. Taking a tile

Players alternate. On a turn, the active player takes one tile from the board and places one of their tokens on the cell it came from. The taken tile is set aside face up and becomes the **last tile**.

- **Opening.** The starting player's first take may be any edge tile.
- **Every later take** must match the last tile. It may come from anywhere on the board; it need not be next to anything.

A cell with a token holds no tile and is never taken again. Tokens never move and are never removed. There is no passing.

## 4. End of the game

After each take, check in this order:

1. **Win by shape.** The player who just took wins if four of their tokens form either of these shapes:
   - a **line**, one of ten in all: a full row, a full column, or one of the two long diagonals, A1-B2-C3-D4 and A4-B3-C2-D1;
   - a **square**, one of nine in all: four tokens filling a 2×2 block.

   Only the player who just took can complete a shape, because tokens never move.
2. **Draw by full board.** If all 16 cells hold tokens, the game is a draw. Each player has then placed all 8 tokens.
3. **Win by blockade.** If no tile left on the board matches the last tile, the next player cannot take one and loses. The player who just took wins.

Otherwise the other player takes the next turn.

## 5. Matches

A match is one game. The first match's starting player is chosen at random, and the starting player alternates from match to match.

## 6. Notes for implementers

- Store the last tile as its terrain/symbol pair. It is always the tile taken on the previous turn.
- The legal takes are the tiles still on the board that match the last tile, or every edge tile still on the board at the opening. Each legal take is one cell.
- The state is fully public, so a player's view of the game is the whole state.
- The board shuffle and a random starting player come from a seeded generator, so a seed, the starting player and the list of taken cells reproduce a game exactly.
