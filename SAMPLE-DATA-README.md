# Sample Data Generator

This script populates the database with sample completed event data for testing purposes.

## What it creates

- **31 Participants** with Gmail accounts
- **1 Completed Event**: "Annual Technology Conference 2025"
- **31 Attendance Records** (all participants in the event with check-in/check-out times)
- **31 Invitations** (all accepted)

## Participants

All participants use the format "Lastname, Firstname" and have Gmail accounts:

1. Alfanta, Renheart (renheart.alfanta@gmail.com)
2. Baco, Juglie (juglie.baco@gmail.com)
3. Balbuena, Ma. Sophia (sophia.balbuena@gmail.com)
4. Bathan, Niña (nina.bathan@gmail.com)
5. Bomediano, Bryan (bryan.bomediano@gmail.com)
6. Bucao, Juvy (juvy.bucao@gmail.com)
7. Burlaza, Jeric (jeric.burlaza@gmail.com)
8. De Castro, Louie (louie.decastro@gmail.com)
9. Dela Vega, Desiree (desiree.delavega@gmail.com)
10. Dibdib, Jay-ar (jayar.dibdib@gmail.com)
11. Dino, Maria (maria.dino@gmail.com)
12. Esqueda, Shiela (shiela.esqueda@gmail.com)
13. Fiel, Marjorie (marjorie.fiel@gmail.com)
14. Galamgam, Krysha (krysha.galamgam@gmail.com)
15. Ganob, Kyla (kyla.ganob@gmail.com)
16. Jalandoni, Reynaldo (reynaldo.jalandoni@gmail.com)
17. Lapore, Joyce (joyce.lapore@gmail.com)
18. Lato, Mary Rose (maryrose.lato@gmail.com)
19. Lozada, Phoebe (phoebe.lozada@gmail.com)
20. Lumain, Jean (jean.lumain@gmail.com)
21. Macabinguil, Cindy (cindy.macabinguil@gmail.com)
22. Mendoza, Mary Jane (maryjane.mendoza@gmail.com)
23. Morillo, Gerry (gerry.morillo@gmail.com)
24. Pascua, Rhealyn (rhealyn.pascua@gmail.com)
25. Patenio, Jessa (jessa.patenio@gmail.com)
26. Pelayo, Charmaine (charmaine.pelayo@gmail.com)
27. Tabasan, Angelica (angelica.tabasan@gmail.com)
28. Tagalog, Nestor (nestor.tagalog@gmail.com)
29. Tiosan, Regine (regine.tiosan@gmail.com)
30. Toledo, Ma. Floramie (floramie.toledo@gmail.com)
31. Villa, Babylyn (babylyn.villa@gmail.com)

**Default password for all participants:** `Password123!`

## Event Details

**Title:** Annual Technology Conference 2025
**Date:** November 15, 2025
**Time:** 09:00 - 17:00
**Location:** Grand Ballroom, Convention Center, Main Campus
**Status:** Completed
**Participants:** All 31 participants (with check-in/check-out times)

## How to run

1. Make sure your MongoDB is running
2. Make sure your `.env` file is configured in the `backend` folder
3. Run the script:

```bash
node backend/scripts/populate-sample-data.js
```

## Notes

- The script checks for existing data and won't create duplicates
- All participants will have `isVerified: true`
- All invitations are set to `status: 'accepted'`
- All attendance logs have `status: 'checked-out'` with random check-in (9:00-9:30) and check-out times (16:30-17:00)
- The first participant (Alfanta, Renheart) is used as the event organizer
