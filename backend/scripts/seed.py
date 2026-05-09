"""Seed the database with mock data from the frontend.

Usage:
    cd backend && uv run python scripts/seed.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dao.database import init_db, get_connection
from dao import catalog_dao, listing_dao
from models import CatalogItem, EstimateLineItem, EstimateListing, EstimateProgress, Material


# ── Estimate listings ────────────────────────────────────────────────

ESTIMATES = [
    EstimateListing(
        id="EST-2418", version="v3",
        name="Delgado residence · 412 W Holloway Ave",
        address="412 W Holloway Ave", city_state="Tampa, FL 33606",
        owner="Maria Delgado", parcel="A-12-29-18-014",
        total="$25,582", margin="38% margin",
        sq="22.4", sq_ft="2,240 sf", status="sent",
        updated="just now", updated_sub="opens 0/1",
    ),
    EstimateListing(
        id="EST-2412", version="v2",
        name="Aldridge bungalow · 1842 Bayshore Blvd",
        address="1842 Bayshore Blvd", city_state="Tampa, FL 33606",
        owner="Carmen & Joel Aldridge", parcel="A-09-29-18-052",
        total="$31,840", margin="42% margin",
        sq="28.1", sq_ft="2,810 sf", status="signed",
        updated="2d ago", updated_sub="install Mar 24",
    ),
    EstimateListing(
        id="EST-2415", version="draft",
        name="Hester duplex · 4920 N Florida Ave",
        address="4920 N Florida Ave", city_state="Tampa, FL 33603",
        owner="Reid Hester", parcel="A-15-28-18-220",
        total=None, margin=None,
        sq="36.2", sq_ft="3,620 sf", status="draft",
        progress=EstimateProgress(current=3, total=5),
        updated="9d stalled", updated_sub="last in pricing", stale_days=9,
    ),
    EstimateListing(
        id="EST-2410", version="v1",
        name="Pham residence · 1206 E 22nd Ave",
        address="1206 E 22nd Ave", city_state="Tampa, FL 33605",
        owner="Linh Pham", parcel="A-22-29-19-103",
        total="$18,920", margin="35% margin",
        sq="17.6", sq_ft="1,760 sf", status="sent",
        updated="3d ago", updated_sub="opens 6/1",
    ),
    EstimateListing(
        id="EST-2409", version="draft",
        name="Okafor home · 7711 Hidden Pines Cir",
        address="7711 Hidden Pines Cir", city_state="Tampa, FL 33625",
        owner="Adaeze Okafor", parcel="A-06-28-17-410",
        total=None, margin=None,
        sq=None, sq_ft="drone scheduled", status="draft",
        progress=EstimateProgress(current=1, total=5),
        updated="1d ago", updated_sub="in capture",
    ),
    EstimateListing(
        id="EST-2406", version="v1",
        name="Watanabe residence · 320 S Westland Ave",
        address="320 S Westland Ave", city_state="Tampa, FL 33606",
        owner="Yuki Watanabe", parcel="A-10-29-18-088",
        total="$22,140", margin="36% margin",
        sq="19.4", sq_ft="1,940 sf", status="signed",
        updated="5d ago", updated_sub="install Mar 18",
    ),
    EstimateListing(
        id="EST-2398", version="v2",
        name="Gianopoulos rental · 8204 Whisper Ridge Dr",
        address="8204 Whisper Ridge Dr", city_state="Lutz, FL 33549",
        owner="Spiros Gianopoulos", parcel="A-31-27-18-040",
        total="$29,460", margin="39% margin",
        sq="26.8", sq_ft="2,680 sf", status="expired",
        updated="38d ago", updated_sub="no response",
    ),
    EstimateListing(
        id="EST-2395", version="draft",
        name="Thibodeaux home · 2117 W Ridge Pl",
        address="2117 W Ridge Pl", city_state="Tampa, FL 33614",
        owner="Etienne Thibodeaux", parcel="A-14-28-18-076",
        total=None, margin=None,
        sq="14.8", sq_ft="1,480 sf", status="draft",
        progress=EstimateProgress(current=2, total=5),
        updated="11d stalled", updated_sub="last in faces", stale_days=11,
    ),
    EstimateListing(
        id="EST-2389", version="v1",
        name="Martín-Reyes home · 5611 Riverhills Dr",
        address="5611 Riverhills Dr", city_state="Tampa, FL 33617",
        owner="Lucia Martín-Reyes", parcel="A-29-28-19-202",
        total="$41,720", margin="44% margin",
        sq="38.6", sq_ft="3,860 sf", status="signed",
        updated="13d ago", updated_sub="installed",
    ),
]

# ── Line items for EST-2418 (the primary demo estimate) ──────────────

LINE_ITEMS_EST_2418 = [
    EstimateLineItem(color="#5a5d62", name="Duration · Estate Gray shingles", detail="22.4 sq · 12% waste · 6 facets", qty="25.1 sq", unit_price="$485.00", total="$12,173.50", category="materials"),
    EstimateLineItem(color="#3a3d44", name="Ridge cap · CertainTeed Mountain Ridge", detail="68 lf · matched to field", qty="68 lf", unit_price="$8.40", total="$571.20", category="materials"),
    EstimateLineItem(color="#e8eaec", name="Ice & water shield · 2 courses", detail="Eaves · valleys · low-slope", qty="6 rolls", unit_price="$94.00", total="$564.00", category="materials"),
    EstimateLineItem(color="#a8aeb6", name="Synthetic underlayment", detail="22.4 sq · 1 layer · 10 sq rolls", qty="3 rolls", unit_price="$112.00", total="$336.00", category="materials"),
    EstimateLineItem(color="#6e5a3f", name="Drip edge · 5\" white aluminum", detail="Eave + rake", qty="112 lf", unit_price="$3.20", total="$358.40", category="materials"),
    EstimateLineItem(color="#586773", name="Pipe boots, vents, step flash", detail="3 boots · 2 box vents · 22 lf flash", qty="1 set", unit_price="$245.00", total="$245.00", category="materials"),
    EstimateLineItem(color="#4C85E5", name="Tear-off & removal", detail="Strip existing roof to decking", qty="22.4 sq", unit_price="$75.00", total="$1,680.00", category="labor"),
    EstimateLineItem(color="#3868C6", name="Install new roof system", detail="Shingle installation labor", qty="22.4 sq", unit_price="$85.00", total="$1,904.00", category="labor"),
    EstimateLineItem(color="#2d5a8e", name="Flashing & detail work", detail="Valleys, walls, chimney, skylights", qty="1 job", unit_price="$286.00", total="$286.00", category="labor"),
    EstimateLineItem(color="#8B5CF6", name="Dumpster rental · 20 yd", detail="Debris haul-off, 1 pull", qty="1 ea", unit_price="$420.00", total="$420.00", category="disposal"),
]

# ── Catalog items ────────────────────────────────────────────────────

CATALOG = [
    # Materials
    CatalogItem(id="mat-shingle-3tab", name="3-Tab Shingles", detail="Standard 3-tab asphalt shingles · 25 yr warranty", color="#5a5d62", default_unit="sq", default_unit_price=320, category="materials"),
    CatalogItem(id="mat-shingle-arch", name="Architectural Shingles", detail="Dimensional laminated shingles · 30 yr warranty", color="#4a4d52", default_unit="sq", default_unit_price=485, category="materials"),
    CatalogItem(id="mat-shingle-designer", name="Designer Shingles", detail="Premium luxury shingles · lifetime warranty", color="#3a3d44", default_unit="sq", default_unit_price=680, category="materials"),
    CatalogItem(id="mat-shingle-impact", name="Impact Resistant Shingles", detail="Class 4 IR rated · hail resistant", color="#5e6268", default_unit="sq", default_unit_price=560, category="materials"),
    CatalogItem(id="mat-ridge-cap", name="Ridge Cap Shingles", detail="Pre-bent hip & ridge shingles", color="#3a3d44", default_unit="lf", default_unit_price=8.4, category="materials"),
    CatalogItem(id="mat-starter-strip", name="Starter Strip Shingles", detail="Pre-cut starter for eaves & rakes", color="#5a5d62", default_unit="lf", default_unit_price=3.8, category="materials"),
    CatalogItem(id="mat-ice-water", name="Ice & Water Shield", detail="Self-adhering membrane · 36\" wide roll", color="#e8eaec", default_unit="roll", default_unit_price=94, category="materials"),
    CatalogItem(id="mat-underlayment-syn", name="Synthetic Underlayment", detail="Breathable synthetic felt · 10 sq rolls", color="#a8aeb6", default_unit="roll", default_unit_price=112, category="materials"),
    CatalogItem(id="mat-underlayment-felt", name="Felt Underlayment #30", detail="#30 organic felt paper · 2 sq rolls", color="#9a9fa6", default_unit="roll", default_unit_price=38, category="materials"),
    CatalogItem(id="mat-drip-edge", name="Drip Edge · Aluminum", detail="5\" white aluminum · 10 ft sections", color="#6e5a3f", default_unit="lf", default_unit_price=3.2, category="materials"),
    CatalogItem(id="mat-drip-edge-steel", name="Drip Edge · Galvanized Steel", detail="5\" galvanized steel · 10 ft sections", color="#7a7e82", default_unit="lf", default_unit_price=4.5, category="materials"),
    CatalogItem(id="mat-pipe-boot", name="Pipe Boot Flashing", detail="Neoprene pipe boot · fits 1-3\" pipes", color="#586773", default_unit="ea", default_unit_price=18, category="materials"),
    CatalogItem(id="mat-box-vent", name="Box Vent · 50 sq in", detail="Static box vent for attic ventilation", color="#5a6068", default_unit="ea", default_unit_price=42, category="materials"),
    CatalogItem(id="mat-ridge-vent", name="Ridge Vent · CertainTeed FilterVent", detail="Externally baffled ridge vent", color="#3d4248", default_unit="lf", default_unit_price=6.8, category="materials"),
    CatalogItem(id="mat-power-vent", name="Power Attic Ventilator", detail="Thermostat-controlled attic fan · 1400 CFM", color="#4a5058", default_unit="ea", default_unit_price=285, category="materials"),
    CatalogItem(id="mat-turbine-vent", name="Turbine Vent · 12\"", detail="Wind-driven turbine ventilator", color="#6a7078", default_unit="ea", default_unit_price=65, category="materials"),
    CatalogItem(id="mat-step-flash", name="Step Flashing · Aluminum", detail="5×7 aluminum step flashing", color="#8a8e92", default_unit="pc", default_unit_price=1.8, category="materials"),
    CatalogItem(id="mat-valley-metal", name="Valley Metal · W-Style", detail="Pre-bent W-valley 24 ga galvanized", color="#7a7e82", default_unit="lf", default_unit_price=5.5, category="materials"),
    CatalogItem(id="mat-chimney-flash-kit", name="Chimney Flashing Kit", detail="Lead step + counter flashing set", color="#5a6068", default_unit="kit", default_unit_price=195, category="materials"),
    CatalogItem(id="mat-roofing-nails", name="Roofing Nails · 1.25\"", detail="Galvanized coil nails · 7200/box", color="#8a8e92", default_unit="box", default_unit_price=52, category="materials"),
    CatalogItem(id="mat-roof-cement", name="Roofing Cement / Mastic", detail="Henry 208 wet-patch · 3.5 gal", color="#2a2d32", default_unit="pail", default_unit_price=28, category="materials"),
    CatalogItem(id="mat-caulk-sealant", name="Roof Sealant / Caulk", detail="Geocel 2300 tripolymer sealant · tube", color="#e0e4e8", default_unit="tube", default_unit_price=8.5, category="materials"),
    CatalogItem(id="mat-plywood-cdx", name="CDX Plywood · 1/2\"", detail="4×8 sheet · decking replacement", color="#c4a87a", default_unit="sheet", default_unit_price=48, category="materials"),
    CatalogItem(id="mat-osb-decking", name="OSB Decking · 7/16\"", detail="4×8 oriented strand board", color="#b8a270", default_unit="sheet", default_unit_price=32, category="materials"),
    CatalogItem(id="mat-fascia-board", name="Fascia Board · PVC", detail="1×6 cellular PVC trim · 16 ft", color="#f0f0f0", default_unit="lf", default_unit_price=4.2, category="materials"),
    CatalogItem(id="mat-soffit-panel", name="Soffit Panel · Vented Vinyl", detail="12\" vinyl vented soffit · 12 ft", color="#e8eaec", default_unit="lf", default_unit_price=5.8, category="materials"),
    CatalogItem(id="mat-gutter-5in", name="Gutters · 5\" K-Style Aluminum", detail="Seamless aluminum gutter · installed", color="#d0d4d8", default_unit="lf", default_unit_price=8.5, category="materials"),
    CatalogItem(id="mat-gutter-6in", name="Gutters · 6\" K-Style Aluminum", detail="Oversized seamless aluminum gutter", color="#c8ccd0", default_unit="lf", default_unit_price=11, category="materials"),
    CatalogItem(id="mat-downspout", name="Downspout · 2×3 Aluminum", detail="Pre-finished aluminum downspout · 10 ft", color="#d8dce0", default_unit="lf", default_unit_price=6.5, category="materials"),
    CatalogItem(id="mat-gutter-guard", name="Gutter Guards · Micro-Mesh", detail="Stainless steel micro-mesh leaf guard", color="#b0b4b8", default_unit="lf", default_unit_price=14, category="materials"),
    CatalogItem(id="mat-skylight-deck", name="Skylight · Deck Mount", detail="VELUX 21×46 fixed deck-mount skylight", color="#88c4e8", default_unit="ea", default_unit_price=480, category="materials"),
    CatalogItem(id="mat-skylight-flash-kit", name="Skylight Flashing Kit", detail="VELUX EDL flashing kit · step + counter", color="#a0a8b0", default_unit="kit", default_unit_price=120, category="materials"),
    CatalogItem(id="mat-metal-standing", name="Standing Seam Metal Panels", detail="24 ga Galvalume snap-lock panels", color="#b0b5b8", default_unit="sq", default_unit_price=450, category="materials"),
    CatalogItem(id="mat-metal-panel-r", name="Metal Panels · R-Panel", detail="26 ga ribbed metal panel · 36\" coverage", color="#8a9098", default_unit="sq", default_unit_price=280, category="materials"),
    CatalogItem(id="mat-tpo-60", name="TPO Membrane · 60 mil", detail="White 60 mil thermoplastic polyolefin", color="#f0f0f0", default_unit="sq", default_unit_price=320, category="materials"),
    CatalogItem(id="mat-epdm", name="EPDM Membrane · 45 mil", detail="Black rubber single-ply membrane", color="#222222", default_unit="sq", default_unit_price=290, category="materials"),
    CatalogItem(id="mat-iso-board", name="Polyiso Insulation Board", detail="2\" polyisocyanurate rigid insulation · 4×8", color="#e8e0c8", default_unit="sheet", default_unit_price=58, category="materials"),
    # Labor
    CatalogItem(id="lab-tearoff", name="Tear-Off & Removal", detail="Strip existing roof system to decking", color="#4C85E5", default_unit="sq", default_unit_price=75, category="labor"),
    CatalogItem(id="lab-install-shingle", name="Install Shingle Roof", detail="Full shingle roof installation", color="#3868C6", default_unit="sq", default_unit_price=85, category="labor"),
    CatalogItem(id="lab-install-metal", name="Install Metal Roof", detail="Standing seam or exposed fastener install", color="#2d5a8e", default_unit="sq", default_unit_price=165, category="labor"),
    CatalogItem(id="lab-install-flat", name="Install Flat / Low-Slope", detail="TPO, EPDM, or modified bitumen install", color="#3a6eb5", default_unit="sq", default_unit_price=140, category="labor"),
    CatalogItem(id="lab-flashing", name="Flashing & Detail Work", detail="Valleys, walls, chimney, pipe boots", color="#2d5a8e", default_unit="job", default_unit_price=286, category="labor"),
    CatalogItem(id="lab-decking-repair", name="Decking Repair / Replacement", detail="Replace rotted sheathing — per sheet", color="#5a80b8", default_unit="sheet", default_unit_price=95, category="labor"),
    CatalogItem(id="lab-fascia-repair", name="Fascia Board Repair", detail="Remove & replace damaged fascia", color="#4a70a8", default_unit="lf", default_unit_price=12, category="labor"),
    CatalogItem(id="lab-soffit-repair", name="Soffit Repair / Replace", detail="Remove & replace damaged soffit panels", color="#4a70a8", default_unit="lf", default_unit_price=14, category="labor"),
    CatalogItem(id="lab-gutter-install", name="Gutter Installation", detail="Install new seamless aluminum gutters", color="#3a60a0", default_unit="lf", default_unit_price=9, category="labor"),
    CatalogItem(id="lab-gutter-remove", name="Gutter Removal", detail="Remove existing gutters & downspouts", color="#5a80b8", default_unit="lf", default_unit_price=3, category="labor"),
    CatalogItem(id="lab-skylight-install", name="Skylight Installation", detail="Cut opening, frame, install + flash", color="#4C85E5", default_unit="ea", default_unit_price=450, category="labor"),
    CatalogItem(id="lab-chimney-reflash", name="Chimney Re-Flash", detail="Remove old flashing, install new step + counter", color="#3868C6", default_unit="ea", default_unit_price=380, category="labor"),
    CatalogItem(id="lab-ridge-vent-install", name="Ridge Vent Installation", detail="Cut slot, install ridge vent + cap", color="#2d5a8e", default_unit="lf", default_unit_price=8, category="labor"),
    CatalogItem(id="lab-drip-edge-install", name="Drip Edge Installation", detail="Install new drip edge at eaves & rakes", color="#4a70a8", default_unit="lf", default_unit_price=3.5, category="labor"),
    CatalogItem(id="lab-pipe-boot-replace", name="Pipe Boot Replacement", detail="Remove old boot, install new neoprene boot", color="#5a80b8", default_unit="ea", default_unit_price=35, category="labor"),
    CatalogItem(id="lab-satellite-reset", name="Satellite Dish Reset", detail="Remove, re-mount & seal after roofing", color="#3a60a0", default_unit="ea", default_unit_price=125, category="labor"),
    CatalogItem(id="lab-solar-detach-reset", name="Solar Panel Detach & Reset", detail="Remove panels, re-install after roofing", color="#4C85E5", default_unit="panel", default_unit_price=185, category="labor"),
    CatalogItem(id="lab-crane-service", name="Crane / Boom Service", detail="Material delivery to roof level — steep or 3+ story", color="#2d5a8e", default_unit="job", default_unit_price=950, category="labor"),
    # Add-ons
    CatalogItem(id="add-gaf-warranty", name="GAF Golden Pledge Warranty", detail="50-yr non-prorated coverage · GAF certified", color="#d4a017", default_unit="ea", default_unit_price=350, category="addons"),
    CatalogItem(id="add-owens-warranty", name="Owens Corning Preferred Protection", detail="Extended manufacturer warranty", color="#d48a17", default_unit="ea", default_unit_price=280, category="addons"),
    CatalogItem(id="add-attic-ventilation", name="Attic Ventilation Upgrade", detail="Add intake + exhaust to meet code ratio", color="#6eb86e", default_unit="job", default_unit_price=520, category="addons"),
    CatalogItem(id="add-solar-fan", name="Solar Attic Fan", detail="30 W solar-powered attic exhaust fan", color="#88c030", default_unit="ea", default_unit_price=385, category="addons"),
    CatalogItem(id="add-radiant-barrier", name="Radiant Barrier Installation", detail="Reflective foil radiant barrier in attic", color="#c0a860", default_unit="sq", default_unit_price=0.95, category="addons"),
    CatalogItem(id="add-insulation-r38", name="Blown-In Insulation · R-38", detail="Cellulose or fiberglass attic blow-in", color="#f0e8d0", default_unit="sqft", default_unit_price=1.8, category="addons"),
    CatalogItem(id="add-gutter-guard", name="Gutter Guard System", detail="Micro-mesh leaf protection · full perimeter", color="#b0b4b8", default_unit="lf", default_unit_price=14, category="addons"),
    CatalogItem(id="add-heat-cable", name="Heat Cable · Ice Dam Prevention", detail="Self-regulating roof & gutter heat cable", color="#e0a040", default_unit="lf", default_unit_price=18, category="addons"),
    CatalogItem(id="add-skylight-new", name="New Skylight Package", detail="Deck-mount skylight + flashing + install", color="#88c4e8", default_unit="ea", default_unit_price=1050, category="addons"),
    CatalogItem(id="add-skylight-tube", name="Tubular Skylight · 14\"", detail="Sun tunnel tubular daylighting device", color="#a8d8f0", default_unit="ea", default_unit_price=650, category="addons"),
    CatalogItem(id="add-chimney-cap", name="Chimney Cap · Stainless Steel", detail="Multi-flue stainless chimney cap + install", color="#a0a8b0", default_unit="ea", default_unit_price=320, category="addons"),
    CatalogItem(id="add-cricket", name="Chimney Cricket", detail="Fabricate & install saddle/diverter above chimney", color="#8a9098", default_unit="ea", default_unit_price=480, category="addons"),
    CatalogItem(id="add-painting-touch", name="Paint Touchup · Fascia & Trim", detail="Spot-prime & paint disturbed fascia/trim", color="#d8dce0", default_unit="lf", default_unit_price=6, category="addons"),
    CatalogItem(id="add-drone-survey", name="Drone Roof Inspection Report", detail="High-res aerial imagery + thermal scan", color="#4C85E5", default_unit="ea", default_unit_price=250, category="addons"),
    # Disposal & Permits
    CatalogItem(id="disp-dumpster-20", name="Dumpster Rental · 20 yd", detail="20 cubic yard roll-off · includes 1 haul", color="#8B5CF6", default_unit="ea", default_unit_price=420, category="disposal"),
    CatalogItem(id="disp-dumpster-30", name="Dumpster Rental · 30 yd", detail="30 cubic yard roll-off · includes 1 haul", color="#7C4DDB", default_unit="ea", default_unit_price=540, category="disposal"),
    CatalogItem(id="disp-extra-haul", name="Extra Dumpster Haul", detail="Additional dump run for over-fill", color="#6D3FC4", default_unit="ea", default_unit_price=275, category="disposal"),
    CatalogItem(id="disp-debris-tarp", name="Ground Protection / Tarps", detail="Landscaping protection around structure", color="#9B7BDB", default_unit="job", default_unit_price=150, category="disposal"),
    CatalogItem(id="disp-magnet-sweep", name="Magnetic Nail Sweep", detail="Final magnetic sweep of yard & driveway", color="#a08cd0", default_unit="job", default_unit_price=85, category="disposal"),
    CatalogItem(id="disp-permit-res", name="Residential Roofing Permit", detail="City / county residential re-roof permit", color="#b8a0e0", default_unit="ea", default_unit_price=275, category="disposal"),
    CatalogItem(id="disp-permit-comm", name="Commercial Roofing Permit", detail="Commercial / multi-family roofing permit", color="#a890d0", default_unit="ea", default_unit_price=450, category="disposal"),
    CatalogItem(id="disp-code-inspect", name="Code Compliance Inspection", detail="Scheduled municipal inspection fee", color="#c0b0e8", default_unit="ea", default_unit_price=125, category="disposal"),
    CatalogItem(id="disp-hoa-review", name="HOA Architectural Review Fee", detail="HOA application + review for exterior work", color="#d0c0f0", default_unit="ea", default_unit_price=75, category="disposal"),
    CatalogItem(id="disp-asbestos-test", name="Asbestos Testing", detail="Lab analysis of suspect roofing material", color="#e84040", default_unit="ea", default_unit_price=350, category="disposal"),
    CatalogItem(id="disp-hazmat-disposal", name="Hazmat Disposal Surcharge", detail="Asbestos-containing material abatement", color="#d03030", default_unit="sq", default_unit_price=45, category="disposal"),
]

# ── Materials swatches ───────────────────────────────────────────────

MATERIALS: list[tuple[Material, int]] = [
    # Shingles
    (Material(id="arch-charcoal", tab="shingle", name="Architectural", sub="Charcoal", price_display="$1.85", price_per_sf=1.85, swatch="#3a3a3a"), 0),
    (Material(id="arch-weathered", tab="shingle", name="Architectural", sub="Weathered Wood", price_display="$1.85", price_per_sf=1.85, swatch="#7a6b5a"), 1),
    (Material(id="arch-onyx", tab="shingle", name="Architectural", sub="Onyx Black", price_display="$1.85", price_per_sf=1.85, swatch="#1a1a1a"), 2),
    (Material(id="arch-pewter", tab="shingle", name="Architectural", sub="Pewter Gray", price_display="$1.85", price_per_sf=1.85, swatch="#8a8a8a"), 3),
    (Material(id="des-barkwood", tab="shingle", name="Designer", sub="Barkwood", price_display="$2.40", price_per_sf=2.4, swatch="#5e4a38"), 4),
    (Material(id="des-slate", tab="shingle", name="Designer", sub="Slate", price_display="$2.40", price_per_sf=2.4, swatch="#5a6570"), 5),
    # Metal
    (Material(id="st-galv", tab="metal", name="Standing Seam", sub="Galvalume", price_display="$4.50", price_per_sf=4.5, swatch="#b0b5b8"), 0),
    (Material(id="st-charcoal", tab="metal", name="Standing Seam", sub="Charcoal", price_display="$4.75", price_per_sf=4.75, swatch="#3a3f42"), 1),
    (Material(id="st-forest", tab="metal", name="Standing Seam", sub="Forest Green", price_display="$4.75", price_per_sf=4.75, swatch="#2d5a3d"), 2),
    (Material(id="st-barn", tab="metal", name="Standing Seam", sub="Barn Red", price_display="$4.75", price_per_sf=4.75, swatch="#7a2e2e"), 3),
    # Membrane
    (Material(id="tpo-white", tab="membrane", name="TPO 60mil", sub="White", price_display="$3.20", price_per_sf=3.2, swatch="#f0f0f0"), 0),
    (Material(id="tpo-tan", tab="membrane", name="TPO 60mil", sub="Tan", price_display="$3.20", price_per_sf=3.2, swatch="#c8b898"), 1),
    (Material(id="epdm-black", tab="membrane", name="EPDM", sub="Black", price_display="$2.90", price_per_sf=2.9, swatch="#222222"), 2),
    (Material(id="pvc-white", tab="membrane", name="PVC 50mil", sub="White", price_display="$3.50", price_per_sf=3.5, swatch="#e8e8e8"), 3),
]


def seed() -> None:
    print("Initializing database...")
    init_db()

    # Clear existing seed data
    with get_connection() as conn:
        conn.execute("DELETE FROM estimate_line_items")
        conn.execute("DELETE FROM estimate_listings")
        conn.execute("DELETE FROM catalog_items")
        conn.execute("DELETE FROM materials")

    print(f"Seeding {len(ESTIMATES)} estimate listings...")
    for est in ESTIMATES:
        listing_dao.save_listing(est)

    print(f"Seeding {len(LINE_ITEMS_EST_2418)} line items for EST-2418...")
    for i, item in enumerate(LINE_ITEMS_EST_2418):
        listing_dao.save_line_item("EST-2418", item, sort_order=i)

    print(f"Seeding {len(CATALOG)} catalog items...")
    for i, item in enumerate(CATALOG):
        catalog_dao.save_catalog_item(item, sort_order=i)

    print(f"Seeding {len(MATERIALS)} material swatches...")
    for mat, order in MATERIALS:
        catalog_dao.save_material(mat, sort_order=order)

    print("Done. Database seeded successfully.")


if __name__ == "__main__":
    seed()
