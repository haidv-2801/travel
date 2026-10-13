-- Defence in depth for hosted Postgres (Supabase): its public Data API would otherwise expose these tables to the anon key.
-- The app connects as the table owner, which bypasses RLS, so behaviour is unchanged. No policies = no access for other roles.
-- Remember to add the same line to any migration that creates a new table.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Destination" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripItemVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripItemComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseShare" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Favorite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripMember" ENABLE ROW LEVEL SECURITY;
