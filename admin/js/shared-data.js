/* ==============================================
   PelotonHub Admin — shared-data.js
   Read-only extract of the storefront's product
   catalog + events, reused so admin numbers
   always match what customers see. Loaded
   standalone (no storefront page-init runs).
   ============================================== */

function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}
function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function peso(n) { return '\u20B1' + Math.round(n).toLocaleString('en-PH'); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function showMsg(el, type, text) {
  if (!el) return;
  el.textContent = text;
  el.className = 'form-msg show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, 4500);
}
function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
function qsa(sel, ctx) { return [...(ctx || document).querySelectorAll(sel)]; }

const TIER_DISCOUNT = { Spoke: 5, Chain: 10, Peloton: 20 };

const PRODUCTS = [

  // ── BUILT BIKES › Mountain Bikes ──────────────
  {
    id: 'mtb-hardtail', name: 'Hardtail Trail Bike', price: 42500, oldPrice: 47000,
    category: 'Built Bikes', subCategory: 'Mountain Bikes', brand: 'Specialized', inStock: true,
    icon: '\uD83D\uDEB5', tag: 'new', image: 'img/products/hardtail-trail.jpg',
    gallery: ['\uD83D\uDEB5', '\u2699\uFE0F', '\uD83D\uDEDE'],
    shortDesc: 'Front suspension only — great for local trail riders.',
    description: 'The Hardtail Trail Bike is the sweet spot for riders who want capable trail performance without the complexity of full suspension. Front suspension absorbs the bumps while the rigid rear keeps power transfer efficient on climbs.',
    specs: [
      ['Frame', 'FACT 11m carbon chassis and rear-end, 29 S-Sizing Enduro Race Geometry, SWAT™ Door internal storage, threaded BB, 170mm travel'],
      ['Fork', 'RockShox Zeb Select, Charger RC damper, 15x110mm, 170mm travel'],
      ['Drivetrain', 'Shimano SLX M7100, 12-speed, 10-51T cassette'],
      ['Brakes', 'TRP Trail EVO, 4-piston hydraulic disc'],
      ['Tires', 'Specialized Butcher, Grid Trail casing, Gripton T9, 29×2.3"'],
      ['Wheel Size', '29"'],
      ['Weight', '16.2 kg / 35.7 lbs'],
      ['Colors', 'Gloss Gunmetal / Satin Cool Grey / Redwood'],
    ],
    sizes: ['S', 'M', 'L', 'XL'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider A — Verified', text: 'Best trail bike at this price. Geometry is spot on.' }]
  },
  {
    id: 'mtb-fs-enduro', name: 'Full-Suspension Enduro Bike', price: 89500, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Mountain Bikes', brand: 'Trek', inStock: true,
    icon: '\uD83D\uDEB5', tag: 'new', image: 'img/products/fs-enduro.jpg',
    gallery: ['\uD83D\uDEB5', '\u2699\uFE0F', '\uD83C\uDFD4'],
    shortDesc: 'Dual suspension for technical downhills.',
    description: 'Built for riders who push into technical terrain, the Full-Suspension Enduro Bike absorbs big hits front and rear so you can carry more speed through rough lines.',
    specs: [['Frame', 'FACT 11m carbon chassis and rear-end, 29 S-Sizing Enduro Race Geometry, SWAT™ Door internal storage, threaded BB, 170mm travel'], ['Fork', 'RockShox Zeb Select, Charger RC damper, 15x110mm, 170mm travel'], ['Drivetrain', 'Shimano SLX M7100, 12-speed, 10-51T cassette'], ['Brakes', 'TRP Trail EVO, 4-piston hydraulic disc'], ['Tires', 'Specialized Butcher, Grid Trail casing, Gripton T9, 29×2.3"'], ['Wheel Size', '29"'], ['Weight', '16.2 kg / 35.7 lbs'], ['Colors', 'Gloss Gunmetal / Satin Cool Grey / Redwood']],
    sizes: ['S', 'M', 'L', 'XL'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider B — Peloton Member', text: 'Handles the gnarliest descents with total confidence.' }]
  },
  {
    id: 'mtb-xc-race', name: 'Cross-Country (XC) Race Bike', price: 72000, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Mountain Bikes', brand: 'Giant', inStock: true,
    icon: '\uD83D\uDEB5', tag: '', image: 'img/products/xc-race.jpg',
    gallery: ['\uD83D\uDEB5', '\u26F3', '\uD83C\uDFC1'],
    shortDesc: 'Lightweight, built for speed on dirt tracks.',
    description: 'Engineered for competitive cross-country racing, every gram has been scrutinized. The XC Race Bike climbs like a mountain goat and corners precisely on tight singletrack.',
    specs: [['Frame', 'Superior Aluminum Alloy, 29" Hardtail, tapered head tube'], ['Fork', 'SR Suntour XCR, Air, 100mm travel, 15mm thru-axle'], ['Drivetrain', 'Shimano Deore, 1x10-speed, 11-46T cassette'], ['Brakes', 'Shimano MT200, hydraulic disc, 180mm front / 160mm rear'], ['Tires', 'Schwalbe Smart Sam 29×2.25", Performance'], ['Wheel Size', '29"'], ['Weight', '14.5 kg / 31 lb 14 oz (MD)'], ['Colors', 'Matte Black / White']],
    sizes: ['XS', 'S', 'M', 'L'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider C — Chain Member', text: 'Shaved two minutes off my personal best on the XC loop.' }]
  },
  {
    id: 'mtb-emtb', name: 'Electric Mountain Bike (e-MTB)', price: 125000, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Mountain Bikes', brand: 'Trek', inStock: false,
    icon: '\uD83D\uDEB5', tag: 'new', image: 'img/products/emtb.jpg',
    gallery: ['\uD83D\uDEB5', '\u26A1', '\uD83D\uDEDE'],
    shortDesc: 'Pedal-assist for tackling steep climbs.',
    description: 'The e-MTB opens up longer, steeper rides to a wider range of fitness levels. Bosch motor integration keeps the weight distribution natural while the 625Wh battery covers a full day of trail riding.',
    specs: [['Frame', 'Specialized M5 alloy, 150mm custom-tuned rear travel, adjustable geometry'], ['Fork', 'FOX 36 Performance, 160mm travel, 44mm offset'], ['Motor', 'Specialized Turbo Full Power 2.2, 90Nm torque, 565W'], ['Drivetrain', 'SRAM GX Eagle, 12-speed, 10-52T cassette'], ['Brakes', 'SRAM DB8, 4-piston hydraulic disc, 200mm rotors'], ['Tires', 'Specialized Butcher Grid Trail T9, 29×2.3" front / 27.5×2.3" rear'], ['Wheel Size', '29" front / 27.5" rear (mixed)'], ['Weight', '23.79 kg / 52 lb 7.2 oz (S4)'], ['Colors', 'Satin Harvest Gold / Tarmac Black']],
    sizes: ['S', 'M', 'L', 'XL'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider D — Verified', text: 'Made our local mountain trail accessible again after my knee surgery.' }]
  },
  {
    id: 'mtb-fat', name: 'Fat-Tire Trail Bike', price: 38500, oldPrice: 42000,
    category: 'Built Bikes', subCategory: 'Mountain Bikes', brand: 'Giant', inStock: true,
    icon: '\uD83D\uDEB5', tag: 'sale', image: 'img/products/fat-tire.jpg',
    gallery: ['\uD83D\uDEB5', '\uD83C\uDFD6', '\u2603'],
    shortDesc: 'Extra-wide 4.8" tires for sand, snow, rocks, and roots.',
    description: 'The Kona Woo is built for riders who refuse to let terrain decide where they go. Its oversized 4.8-inch tires roll over sand, snow, mud, and rocky singletrack with equal confidence, while the trail-oriented geometry keeps things balanced on the way up and planted on the way down.<br><br>A 12-speed Shimano Deore drivetrain paired with an 11×51T cassette handles serious elevation without complaint. The carbon fork comes loaded with three pack-cage mounts per side and the down tube adds two bottle cage positions — making this a surprisingly capable bikepacking rig. At just 33 lbs, it is light enough to throw in a train car or haul up a flight of stairs, which is rare for a fat bike at this level.',
    specs: [['Frame', 'Aluminum'], ['Fork', 'Kona Woo Fat Carbon'], ['Drivetrain', 'Shimano Deore 12-speed (11–51T)'], ['Brakes', 'Shimano MT410 Hydraulic Disc'], ['Tires', '26" × 4.8" Tubeless-Ready'], ['Wheel Size', '26 in.'], ['Weight', '33 lb (15 kg)'], ['Colors', 'Matte Pewter Green / Dark Teal']],
    sizes: ['S', 'M', 'L'], defaultSize: 'M',
    seedReviews: [{ rating: 4, author: 'Rider E — Spoke Member', text: 'Beach trail rides feel totally different on fat tires. So much fun.' }]
  },

  // ── BUILT BIKES › Road & Gravel Bikes ─────────
  {
    id: 'road-aero', name: 'Carbon Fiber Aero Road Bike', price: 165000, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Road & Gravel Bikes', brand: 'Trek', inStock: false,
    icon: '\uD83D\uDEB4', tag: 'new', image: 'img/products/carbon-aero-road.jpg',
    gallery: ['\uD83D\uDEB4', '\uD83C\uDFC1', '\u2699\uFE0F'],
    shortDesc: 'Built strictly for high-speed pavement riding.',
    description: 'Every tube profile, cable routing choice, and component spec on this carbon aero road bike has been optimized for raw speed on smooth pavement. If you are racing or chasing PRs, this is it.',
    specs: [['Frame', 'Canyon Aeroad CFR Carbon, 12x142mm thru-axle, internal routing'], ['Fork', 'Canyon FK0137 CF Disc Carbon, 12x100mm thru-axle'], ['Drivetrain', 'SRAM RED AXS 12-speed electronic / Shimano Dura-Ace Di2 12-speed'], ['Brakes', 'SRAM RED AXS / Shimano Dura-Ace Hydraulic Disc'], ['Tires', 'Continental Grand Prix 5000 S TR, 700x26c front / 700x28c rear'], ['Wheel Size', '700c'], ['Weight', '6.9 kg / 15.2 lbs'], ['Colors', 'Pro Black, Crystal White, Metallic Acid, Paradigm Shift']],
    sizes: ['XS', 'S', 'M', 'L', 'XL'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider F — Peloton Member', text: 'Fastest bike I have ever ridden. Di2 shifts are instant.' }]
  },
  {
    id: 'road-endurance', name: 'Endurance Road Bike', price: 68000, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Road & Gravel Bikes', brand: 'Giant', inStock: true,
    icon: '\uD83D\uDEB4', tag: '', image: 'img/products/endurance-road.jpg',
    gallery: ['\uD83D\uDEB4', '\uD83D\uDDFA', '\u2699\uFE0F'],
    shortDesc: 'Designed for comfort over long-distance road events.',
    description: 'The endurance geometry puts you in a slightly upright, relaxed position that pays dividends on 100km+ charity rides. Carbon fork absorbs vibration that would leave you fatigued on a full aluminum build.',
    specs: [['Frame', 'FACT 10R, Rider First Engineered™, FreeFoil Shape Library tubes, threaded BB, 12x142mm thru-axle, flat-mount disc'], ['Fork', 'Future Shock 3.2 w/ Smooth Boot, FACT Carbon, 12x100mm thru-axle, flat-mount disc'], ['Drivetrain', 'SRAM Rival eTAP AXS, 12-speed, 10-36T cassette, 46/33T chainrings'], ['Brakes', 'SRAM Rival Hydraulic Disc, 160mm (front & rear)'], ['Tires', 'S-Works Mondo 2BR, 700x32c (front & rear)'], ['Wheel Size', '700c'], ['Weight', '8.62 kg / 19 lb 0.1 oz (56)'], ['Colors', 'Gloss Sea Foam / Violet / Pearl']],
    sizes: ['XS', 'S', 'M', 'L', 'XL'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider G — Chain Member', text: 'Finished a 120km charity ride and my back felt fine. This bike just works.' }]
  },
  {
    id: 'road-gravel', name: 'All-Road Gravel Bike', price: 58000, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Road & Gravel Bikes', brand: 'Giant', inStock: true,
    icon: '\uD83D\uDEB4', tag: '', image: 'img/products/all-road-gravel.jpg',
    gallery: ['\uD83D\uDEB4', '\uD83D\uDEE3', '\uD83C\uDFD4'],
    shortDesc: 'Versatile build for swapping between pavement and dirt roads.',
    description: 'Gravel bikes are the Swiss army knife of cycling. Wide tire clearance and a stable geometry make this equally at home grinding through Metro Manila traffic and blasting gravel roads outside the city.',
    specs: [['Frame', '500 Series OCLV Carbon, Rear IsoSpeed, internal frame storage'], ['Fork', 'Domane SL Carbon, tapered carbon steerer, 12x100mm thru-axle'], ['Drivetrain', 'Shimano 105 R7100 Di2 12-speed'], ['Brakes', 'Shimano 105 Hydraulic Disc, 160mm RT70 centerlock rotors'], ['Tires', 'Bontrager R3 Hard-Case Lite TLR, 700x32c (clears up to 38mm)'], ['Wheel Size', '700c'], ['Weight', '8.9 kg / 19.6 lbs'], ['Colors', 'Satin Trek Black']],
    sizes: ['XS', 'S', 'M', 'L', 'XL'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider H — Verified', text: 'Rode pavement to dirt and back without stopping to adjust anything.' }]
  },
  {
    id: 'road-bikepacking', name: 'Bikepacking Adventure Bike', price: 52000, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Road & Gravel Bikes', brand: 'PelotonHub', inStock: true,
    icon: '\uD83D\uDEB4', tag: '', image: 'img/products/bikepacking.jpg',
    gallery: ['\uD83D\uDEB4', '\uD83C\uDF92', '\uD83D\uDDFA'],
    shortDesc: 'Steel frame with multiple mounts for heavy gear bags.',
    description: 'Built for multi-day adventure rides, this steel bikepacking frame soaks up road buzz on long days while its numerous bag and rack mounts handle the weight of your overnight kit with ease.',
    specs: [['Frame', 'Triple-butted CroMoly Steel, Alternator flat-mount dropouts'], ['Fork', 'Firestarter Carbon Deluxe, three-pack cargo mounts, internal dynamo routing'], ['Drivetrain', 'Shimano GRX RX610 / RX810, 1x12-speed'], ['Brakes', 'TRP Spyre-C / Shimano GRX Hydraulic Disc'], ['Tires', 'Maxxis Rekon 29x2.6" (clears up to 29x3.0" / 27.5x3.0")'], ['Wheel Size', '29" (compatible with 27.5+)'], ['Weight', '11.8 kg / 26.0 lbs'], ['Colors', 'Moss Green, Gold, Red-Orange']],
    sizes: ['XS', 'S', 'M', 'L', 'XL'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider I — Peloton Member', text: 'Toured the Bataan Peninsula fully loaded. Handled every km without complaint.' }]
  },
  {
    id: 'road-cyclocross', name: 'Cyclocross Race Bike', price: 75000, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Road & Gravel Bikes', brand: 'Trek', inStock: false,
    icon: '\uD83D\uDEB4', tag: 'new', image: 'img/products/cyclocross.jpg',
    gallery: ['\uD83D\uDEB4', '\uD83C\uDFC1', '\uD83C\uDF27'],
    shortDesc: 'Agile geometry engineered for muddy closed-circuit racing.',
    description: 'Cyclocross geometry demands a bike that can accelerate hard out of corners, survive dismounts, and stay rideable in thick mud. This race-proven build delivers on all three.',
    specs: [['Frame', 'Canyon Inflite CF SLX Carbon, top-tube shoulder kink design, 12x142mm'], ['Fork', 'Canyon FK0045 CF Disc Carbon, 12x100mm'], ['Drivetrain', 'SRAM Force AXS / Shimano Ultegra Di2, 1x12-speed'], ['Brakes', 'Hydraulic Disc, 160mm front / 140mm rear'], ['Tires', 'Schwalbe X-One Allround TLE, 700x33c'], ['Wheel Size', '700c (650b on 3XS/2XS sizes)'], ['Weight', '7.8 kg / 17.1 lbs'], ['Colors', 'Aurora']],
    sizes: ['XS', 'S', 'M', 'L'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider J — Verified', text: 'Podium-ready right out of the box. Handling is razor sharp.' }]
  },

  // ── BUILT BIKES › Urban & Commuter Bikes ──────
  {
    id: 'urban-stepthrough', name: 'Step-Through City Commuter', price: 18500, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Urban & Commuter Bikes', brand: 'Giant', inStock: true,
    icon: '\uD83D\uDEB2', tag: '', image: 'img/products/step-through.jpg',
    gallery: ['\uD83D\uDEB2', '\uD83C\uDFD9', '\uD83C\uDF26'],
    shortDesc: 'Practical everyday bike with rear rack and fenders.',
    description: 'A step-through frame makes mounting and dismounting easy in work clothes or a dress. The included rear rack and fenders mean you arrive at the office clean and ready.',
    specs: [['Frame', 'Specialized A1 Premium Aluminum, Low-Entry design'], ['Fork', 'Formed Steel Hi-Ten Tubes, disc brake mount'], ['Drivetrain', 'microSHIFT RD-M26S, 1x7-speed'], ['Brakes', 'Tektro Mechanical Disc, 160mm rotors'], ['Tires', 'Specialized Nimbus II Sport, 650b x 2.3"'], ['Wheel Size', '650b (27.5")'], ['Weight', '13.2 kg / 29.0 lbs'], ['Colors', 'Blue']],
    sizes: ['One Size'], defaultSize: 'One Size',
    seedReviews: [{ rating: 5, author: 'Rider K — Spoke Member', text: 'Getting on and off in my work skirt is a breeze. Highly recommend for city riding.' }]
  },
  {
    id: 'urban-fixie', name: 'Fixie / Single-Speed Street Bike', price: 14500, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Urban & Commuter Bikes', brand: 'PelotonHub', inStock: true,
    icon: '\uD83D\uDEB2', tag: '', image: 'img/products/fixie.jpg',
    gallery: ['\uD83D\uDEB2', '\uD83C\uDFD9', '\uD83C\uDFA8'],
    shortDesc: 'Low-maintenance, lightweight urban ride.',
    description: 'One gear, two options — ride fixed or flip to freewheel. Less to maintain, less to break, and the minimal aesthetic looks great locked up outside any coffee shop.',
    specs: [['Frame', 'Durable 4130 Grade High-Tensile Steel'], ['Fork', 'High-Tensile Steel fork'], ['Drivetrain', 'Single Speed / Fixed Gear, flip-flop hub, 44x16 ratio'], ['Brakes', 'Dual-Pivot Caliper Rim Brakes (front & rear)'], ['Tires', 'Kenda 700x28c'], ['Wheel Size', '700c (40mm Deep-V Rims)'], ['Weight', '11.1 kg / 24.5 lbs'], ['Colors', 'Rigby (Navy/Creme), Wulf (Matte Black), Earthstone']],
    sizes: ['XS', 'S', 'M', 'L'], defaultSize: 'M',
    seedReviews: [{ rating: 4, author: 'Rider L — Verified', text: 'Light and responsive. Exactly what I wanted for my BGC commute.' }]
  },
  {
    id: 'urban-folding', name: 'Folding Compact Bike', price: 22000, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Urban & Commuter Bikes', brand: 'PelotonHub', inStock: true,
    icon: '\uD83D\uDEB2', tag: '', image: 'img/products/folding.jpg',
    gallery: ['\uD83D\uDEB2', '\uD83D\uDE83', '\uD83C\uDFE2'],
    shortDesc: 'Ideal for multi-modal commuters taking the train or bus.',
    description: 'Folds in under 15 seconds and fits in a locker, under a desk, or in an MRT overhead rack. Pair it with your Beep card and door-to-door commute times drop dramatically.',
    specs: [['Frame', 'Hand-brazed heat-treated steel main frame and rear frame'], ['Fork', 'Steel brazed fork'], ['Drivetrain', 'Brompton 2, 6, or 12-speed internal hub & derailleur hybrid'], ['Brakes', 'Brompton Dual-Pivot Caliper Brakes'], ['Tires', 'Schwalbe Marathon Racer, 349x35c (16x1-3/8")'], ['Wheel Size', '16" (349mm)'], ['Weight', '11.3–12.1 kg / 25.0–26.6 lbs'], ['Colors', 'Plum Red']],
    sizes: ['One Size'], defaultSize: 'One Size',
    seedReviews: [{ rating: 5, author: 'Rider M — Chain Member', text: 'Takes the train to work and cycles the last mile. Total game-changer.' }]
  },
  {
    id: 'urban-e-commuter', name: 'Class 3 Electric Commuter Bike', price: 68000, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Urban & Commuter Bikes', brand: 'Trek', inStock: false,
    icon: '\uD83D\uDEB2', tag: 'new', image: 'img/products/e-commuter.jpg',
    gallery: ['\uD83D\uDEB2', '\u26A1', '\uD83C\uDFD9'],
    shortDesc: 'High-speed pedal assist up to 45kph for fast city transits.',
    description: 'Class 3 assist kicks you up to 45kph so you can keep pace with traffic and skip the LRT. Integrated lights, a rear rack, and a 500Wh battery make this a complete commuter package.',
    specs: [['Frame', 'E5 Premium Aluminum, integrated downtube battery, internal routing'], ['Fork', 'SR Suntour Mobie34 AIR, 80mm travel, thru-axle'], ['Drivetrain', 'SRAM GX 11-speed / Shimano CUES 11-speed'], ['Brakes', 'SRAM DB8 / Shimano 4-piston hydraulic disc, 180mm rotors'], ['Tires', 'Pathfinder Sport Reflect, 650b x 2.3"'], ['Wheel Size', '650b (27.5")'], ['Weight', '25.3 kg / 55.7 lbs'], ['Colors', 'Gloss Silver Dust / Gloss Amethyst']],
    sizes: ['S', 'M', 'L'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider N — Verified', text: 'Commute from Marikina to Makati in 35 minutes flat. Worth every peso.' }]
  },
  {
    id: 'urban-cargo', name: 'Heavy-Duty Electric Cargo Bike', price: 95000, oldPrice: null,
    category: 'Built Bikes', subCategory: 'Urban & Commuter Bikes', brand: 'Trek', inStock: false,
    icon: '\uD83D\uDEB2', tag: 'new', image: 'img/products/cargo-ebike.jpg',
    gallery: ['\uD83D\uDEB2', '\uD83D\uDCE6', '\u26A1'],
    shortDesc: 'Extended racks for groceries or deliveries.',
    description: 'Built to haul, the cargo e-bike carries up to 100kg of payload across front and rear extended racks while the motor keeps the whole rig feeling nimble in traffic.',
    specs: [['Frame', '6061 Aluminum, patented MultiTruss design (463 lb gross limit)'], ['Fork', 'Custom SR Suntour, Chromoly steerer, 34mm stanchions, thru-axle'], ['Drivetrain', 'Shimano Deore Shadow+ 1x10-speed, Bosch Cargo Line 85Nm motor'], ['Brakes', 'Magura MT-C ABS, 4-piston hydraulic disc, 203mm rotors'], ['Tires', 'Schwalbe Pick-Up Cargo-Optimized, 20x2.4" / 20x2.6"'], ['Wheel Size', '20"'], ['Weight', '37.3 kg / 82.3 lbs'], ['Colors', 'Tidal Blue']],
    sizes: ['One Size'], defaultSize: 'One Size',
    seedReviews: [{ rating: 5, author: 'Rider O — Peloton Member', text: 'Running daily grocery deliveries. Motor handles full loads on EDSA bridges easily.' }]
  },

  // ── BIKE PARTS & ACCESSORIES › Drivetrain & Components ──
  {
    id: 'comp-cassette', name: '12-Speed Cassette', price: 4800, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'Drivetrain & Components', brand: 'Shimano', inStock: true,
    icon: '\u2699\uFE0F', tag: '', image: null,
    gallery: ['\u2699\uFE0F', '\uD83D\uDD27', '\u26D3\uFE0F'],
    shortDesc: 'High-performance rear gear cluster replacement.',
    description: 'A direct-fit replacement cassette for most 12-speed MTB drivetrains. Wide range means you keep the gear you need on the steepest local climbs without sacrificing your top-end sprinting.',
    specs: [['Speeds', '12-speed'], ['Range', '10–51T'], ['Compatibility', 'Shimano HG+, SRAM XD with adapter'], ['Weight', '385 g']],
    sizes: null,
    seedReviews: [{ rating: 5, author: 'Rider P — Verified', text: 'Shifting is crisp and consistent. Perfect replacement.' }]
  },
  {
    id: 'comp-brake-set', name: 'Hydraulic Disc Brake Caliper & Lever Set', price: 8500, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'Drivetrain & Components', brand: 'Shimano', inStock: true,
    icon: '\uD83D\uDD27', tag: '', image: null,
    gallery: ['\uD83D\uDD27', '\u2699\uFE0F', '\uD83D\uDEB5'],
    shortDesc: 'Premium stopping power upgrade.',
    description: 'Hydraulic disc brakes offer significantly more modulation and power than cable-actuated alternatives. This front + rear set includes levers, calipers, rotors, and all mounting hardware.',
    specs: [['Type', 'Hydraulic disc'], ['Rotors', '180mm front, 160mm rear'], ['Lever Reach', 'Tool-free reach adjust'], ['Compatibility', 'Post mount & flat mount adapters included'], ['Weight', '640 g (pair)']],
    sizes: null,
    seedReviews: [{ rating: 5, author: 'Rider Q — Chain Member', text: 'Night and day difference over my old cable brakes. One-finger stopping power.' }]
  },
  {
    id: 'comp-wheelset', name: 'Tubeless-Ready Carbon Wheelset', price: 32000, oldPrice: 36000,
    category: 'Bike Parts & Accessories', subCategory: 'Drivetrain & Components', brand: 'SRAM', inStock: true,
    icon: '\uD83D\uDEDE', tag: 'sale', image: null,
    gallery: ['\uD83D\uDEDE', '\u2699\uFE0F', '\uD83D\uDEB4'],
    shortDesc: 'Lightweight wheel upgrade for road or gravel.',
    description: 'Stiff, light, and tubeless-ready out of the box, these carbon wheels transform the feel of any road or gravel bike. Wider internal rim width supports modern tire widths and lower pressures.',
    specs: [['Rim Material', 'Carbon fiber'], ['Internal Width', '21mm'], ['Hub', 'DT Swiss 350 internals'], ['Compatibility', 'Road / Gravel 700c'], ['Weight', '1,380 g (pair)']],
    sizes: null,
    seedReviews: [{ rating: 5, author: 'Rider R — Peloton Member', text: 'Bike feels 2kg lighter with these on. Rolling resistance is noticeably lower.' }]
  },
  {
    id: 'comp-saddle', name: 'Ergonomic Gel Saddle', price: 2800, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'Drivetrain & Components', brand: 'PelotonHub', inStock: true,
    icon: '\uD83E\uDE91', tag: '', image: null,
    gallery: ['\uD83E\uDE91', '\uD83D\uDEB4', '\u2699\uFE0F'],
    shortDesc: 'Comfort upgrade for long endurance charity rides.',
    description: 'Gel padding in the sit-bone zone takes the sting out of marathon charity event routes. The center relief channel reduces pressure on soft tissue over extended hours in the saddle.',
    specs: [['Padding', 'Multi-density gel foam'], ['Rail', 'Chromoly'], ['Width', '142mm, 155mm options'], ['Weight', '310 g']],
    sizes: null,
    seedReviews: [{ rating: 4, author: 'Rider S — Spoke Member', text: 'Switched from a racing saddle and the difference on long rides is huge.' }]
  },
  {
    id: 'comp-pedals', name: 'Clipless Road Pedals', price: 5200, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'Drivetrain & Components', brand: 'Shimano', inStock: true,
    icon: '\u2699\uFE0F', tag: '', image: null,
    gallery: ['\u2699\uFE0F', '\uD83D\uDEB4', '\uD83C\uDFC1'],
    shortDesc: 'High-efficiency pedals for competitive and avid road cyclists.',
    description: 'SPD-SL compatible clipless pedals with a large platform for power transfer and a wide float adjustment for knee health on long rides.',
    specs: [['Type', 'Clipless (SPD-SL compatible)'], ['Platform', 'Composite body, stainless steel axle'], ['Float', '0°, 2°, 6° cleat options'], ['Weight', '248 g (pair)']],
    sizes: null,
    seedReviews: [{ rating: 5, author: 'Rider T — Chain Member', text: 'Smooth engagement and release. Great value for the price.' }]
  },

  // ── BIKE PARTS & ACCESSORIES › Safety & Rider Gear ──
  {
    id: 'gear-helmet', name: 'MIPS Integrated Bicycle Helmet', price: 4500, oldPrice: 5200,
    category: 'Bike Parts & Accessories', subCategory: 'Safety & Rider Gear', brand: 'PelotonHub', inStock: true,
    icon: '\uD83E\uDECE', tag: '', image: null,
    gallery: ['\uD83E\uDECE', '\uD83D\uDEB5', '\u2699\uFE0F'],
    shortDesc: 'Advanced rotational impact protection technology.',
    description: 'MIPS technology adds a low-friction layer inside the helmet that moves independently during an angled impact, reducing rotational force on the brain. Twenty ventilation channels keep you cool.',
    specs: [['Protection', 'MIPS rotational impact liner'], ['Ventilation', '20 channels'], ['Weight', '280 g'], ['Sizes', 'S / M / L'], ['Certification', 'CPSC, EN 1078']],
    sizes: ['S', 'M', 'L'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider U — Verified', text: 'Fits perfectly and the MIPS gives real peace of mind on fast descents.' }]
  },
  {
    id: 'gear-headlight', name: '1200-Lumen Rechargeable Smart Headlight', price: 3200, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'Safety & Rider Gear', brand: 'PelotonHub', inStock: true,
    icon: '\uD83D\uDCA1', tag: 'new', image: null,
    gallery: ['\uD83D\uDCA1', '\uD83D\uDD0B', '\uD83D\uDEB2'],
    shortDesc: 'High-visibility light for night riding and daily commuting.',
    description: 'Twelve hundred lumens is enough to light a completely unlit provincial road at speed. Smart auto-brightness mode adjusts output to ambient light so you never get blinded by oncoming traffic on a lit street.',
    specs: [['Output', '1200 lumens max'], ['Modes', 'Smart auto, High, Medium, Low, Flash'], ['Battery', 'USB-C, 90-minute full charge, 8-hour runtime (medium)'], ['Mount', 'GoPro-compatible quick-release'], ['Rating', 'IPX6']],
    sizes: null,
    seedReviews: [{ rating: 5, author: 'Rider V — Chain Member', text: 'Lights up my entire night commute like daylight. Smart mode works perfectly.' }]
  },
  {
    id: 'gear-bib-shorts', name: 'Padded Cycling Bib Shorts', price: 2400, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'Safety & Rider Gear', brand: 'PelotonHub', inStock: true,
    icon: '\uD83E\uDE72', tag: '', image: null,
    gallery: ['\uD83E\uDE72', '\uD83D\uDEB4', '\uD83C\uDFC1'],
    shortDesc: 'Essential comfort gear for long charity event routes.',
    description: 'Anatomically shaped 8mm chamois padding and flatlock stitching eliminate pressure points and saddle soreness on rides that stretch past three hours.',
    specs: [['Chamois', '8mm multi-density foam'], ['Material', 'Compression lycra with mesh panels'], ['Grippers', 'Wide silicone leg grippers'], ['Sizes', 'XS–XXL'], ['UPF', '50+']],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider W — Peloton Member', text: 'Rode 160km with zero chafing. The chamois quality is excellent.' }]
  },
  {
    id: 'gear-jacket', name: 'High-Visibility Windproof Cycling Jacket', price: 3600, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'Safety & Rider Gear', brand: 'PelotonHub', inStock: true,
    icon: '\uD83E\uDDE5', tag: '', image: null,
    gallery: ['\uD83E\uDDE5', '\uD83D\uDEB4', '\uD83C\uDF07'],
    shortDesc: 'Reflective apparel for adverse weather riding.',
    description: '360-degree reflective elements make you visible from every angle on early-morning and night rides. The windproof shell cuts through headwind while remaining breathable enough not to overheat.',
    specs: [['Shell', 'Windproof, water-resistant DWR coating'], ['Reflectivity', '360° retroreflective strips'], ['Pockets', '2 rear + 1 zipped chest'], ['Sizes', 'XS–XXL'], ['Pack', 'Packs into rear pocket']],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], defaultSize: 'M',
    seedReviews: [{ rating: 4, author: 'Rider X — Chain Member', text: 'Kept me dry in a surprise rain shower and drivers actually see me now.' }]
  },
  {
    id: 'gear-gloves', name: 'Touchscreen-Compatible Cycling Gloves', price: 980, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'Safety & Rider Gear', brand: 'PelotonHub', inStock: true,
    icon: '\uD83E\uDDE4', tag: '', image: null,
    gallery: ['\uD83E\uDDE4', '\uD83D\uDCF1', '\uD83D\uDEB4'],
    shortDesc: 'Full-finger protection with mobile device usability.',
    description: 'Touchscreen-compatible fingertips mean you can navigate Strava or answer a call without pulling off your gloves. Padded palm gel inserts reduce road vibration on longer rides.',
    specs: [['Compatibility', 'Touchscreen fingertips'], ['Padding', 'Gel palm inserts'], ['Closure', 'Velcro wrist strap'], ['Sizes', 'XS–XXL']],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], defaultSize: 'M',
    seedReviews: [{ rating: 5, author: 'Rider Y — Spoke Member', text: 'Finally I can use my phone without taking gloves off. Small but huge quality of life win.' }]
  },

  // ── BIKE PARTS & ACCESSORIES › On-Bike Storage & Maintenance ──
  {
    id: 'storage-framebag', name: 'Waterproof Frame Bag', price: 1850, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'On-Bike Storage & Maintenance', brand: 'PelotonHub', inStock: true,
    icon: '\uD83C\uDF92', tag: '', image: null,
    gallery: ['\uD83C\uDF92', '\uD83D\uDEB4', '\uD83D\uDDFA'],
    shortDesc: 'Storage inside the bike frame triangle for long rides.',
    description: 'Maximizes the dead space inside your frame triangle with a water-resistant roll-top bag that fits tools, food, and a rain jacket without affecting bike handling.',
    specs: [['Capacity', '2L'], ['Material', 'TPU-coated ripstop nylon'], ['Closure', 'Roll-top + magnetic top tube strap'], ['Compatibility', 'Most 700c and 29er frames'], ['Rating', 'IPX4 splash-proof']],
    sizes: null,
    seedReviews: [{ rating: 5, author: 'Rider Z — Verified', text: 'Perfect for carrying my wallet, tools, and a snack on charity rides.' }]
  },
  {
    id: 'storage-ulock', name: 'Heavy-Duty Hardened Steel U-Lock', price: 1650, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'On-Bike Storage & Maintenance', brand: 'PelotonHub', inStock: true,
    icon: '\uD83D\uDD12', tag: '', image: null,
    gallery: ['\uD83D\uDD12', '\uD83D\uDD11', '\uD83D\uDEB2'],
    shortDesc: 'Maximum security protection for urban commuters.',
    description: 'Sold Secure Gold-rated hardened steel shackle resists angle grinder attacks significantly longer than budget locks. Double-locking mechanism protects both shackle legs.',
    specs: [['Shackle', 'Hardened steel, 13mm diameter'], ['Mechanism', 'Double-locking'], ['Rating', 'Sold Secure Gold'], ['Includes', '2 keys, frame mount bracket'], ['Weight', '1.4 kg']],
    sizes: null,
    seedReviews: [{ rating: 5, author: 'Rider AA — Verified', text: 'Leaves for work and comes home with the bike still there. That is all you need.' }]
  },
  {
    id: 'storage-pump', name: 'High-Pressure Floor Pump with Gauge', price: 1200, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'On-Bike Storage & Maintenance', brand: 'PelotonHub', inStock: true,
    icon: '\uD83D\uDEE0', tag: '', image: null,
    gallery: ['\uD83D\uDEE0', '\uD83D\uDEDE', '\uD83D\uDD27'],
    shortDesc: 'Essential home maintenance garage tool.',
    description: 'An accurate floor pump is the single most-used tool in any cyclists garage. Dual Presta/Schrader head, 160psi max, and a large easy-read gauge dial make this a workshop staple.',
    specs: [['Max Pressure', '160 psi / 11 bar'], ['Head', 'Dual Presta/Schrader, locking lever'], ['Gauge', 'Analog dial, 70mm diameter'], ['Hose Length', '70 cm'], ['Weight', '0.9 kg']],
    sizes: null,
    seedReviews: [{ rating: 5, author: 'Rider BB — Chain Member', text: 'Accurate, sturdy, and easy to use one-handed. Bought it 2 years ago and it is still perfect.' }]
  },
  {
    id: 'storage-multitool', name: '16-in-1 Compact Bike Multi-Tool', price: 650, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'On-Bike Storage & Maintenance', brand: 'PelotonHub', inStock: true,
    icon: '\uD83D\uDD27', tag: '', image: null,
    gallery: ['\uD83D\uDD27', '\u2699\uFE0F', '\uD83C\uDF92'],
    shortDesc: 'Pocket-sized emergency tool for roadside adjustments.',
    description: 'Sixteen tools fold into a package lighter than a phone. Allen keys, a chain breaker, spoke key, screwdrivers, and tire levers cover 95% of roadside mechanicals.',
    specs: [['Tools', 'Allen keys 2–8mm, chain breaker, spoke key, screwdrivers, tire levers'], ['Material', 'Hardened steel blades, aluminum body'], ['Weight', '148 g'], ['Dimensions', '95 × 38 × 18 mm']],
    sizes: null,
    seedReviews: [{ rating: 5, author: 'Rider CC — Spoke Member', text: 'Fixed a snapped derailleur hanger on the trail with this. Never leaving home without it.' }]
  },
  {
    id: 'storage-tubeless-kit', name: 'Tubeless Tire Repair & Inflation Kit', price: 890, oldPrice: null,
    category: 'Bike Parts & Accessories', subCategory: 'On-Bike Storage & Maintenance', brand: 'PelotonHub', inStock: true,
    icon: '\uD83D\uDEDE', tag: '', image: null,
    gallery: ['\uD83D\uDEDE', '\uD83D\uDD27', '\uD83D\uDCA8'],
    shortDesc: 'CO2 inflator and plug kit for fast tubeless puncture fixes.',
    description: 'A plugged tubeless tire is back in action in under two minutes. This kit has everything: plugger tool, bacon strip plugs, a CO2 inflator, and two 25g cartridges to get you rolling again fast.',
    specs: [['Contents', 'Plugger tool, 5× bacon strips, CO2 inflator head, 2× 25g CO2 cartridges'], ['Compatibility', 'Tubeless tires, Presta valve'], ['Weight', '115 g complete kit'], ['Carry', 'Included zip pouch']],
    sizes: null,
    seedReviews: [{ rating: 5, author: 'Rider DD — Chain Member', text: 'Plugged a thorn puncture and was back riding in under 90 seconds. Essential kit.' }]
  }
];
const PRODUCTS_BY_ID = {};
PRODUCTS.forEach(function (p) { PRODUCTS_BY_ID[p.id] = p; });
function getProduct(id) { return PRODUCTS_BY_ID[id] || null; }

const EVENTS = [
  { id: 'mtn-ride', date: { mo: 'Aug', dd: '10', yr: '2026' }, kicker: 'Group Ride', dist: '28km', title: 'Sunday Mountain Ride', desc: '\uD83D\uDCCD Mt. Banahaw Trail, Quezon \u00B7 6:00 AM \u00B7 Intermediate skill level \u00B7 Helmet required', cap: 50, filled: 32, vip: false, featured: true },
  { id: 'charity-ride', date: { mo: 'Aug', dd: '17', yr: '2026' }, kicker: 'Charity Ride', dist: '15km', title: 'Bikes for Kids Charity Ride', desc: '\uD83D\uDCCD Luneta Park Loop, Manila \u00B7 7:00 AM \u00B7 All levels welcome \u00B7 Proceeds go directly to Bikes for Kids PH', cap: 100, filled: 67, vip: false, featured: false },
  { id: 'night-ride', date: { mo: 'Aug', dd: '24', yr: '2026' }, kicker: 'Night Ride', dist: '20km', title: 'Urban Night Ride', desc: '\uD83D\uDCCD BGC Circuit, Taguig \u00B7 8:00 PM \u00B7 Lights mandatory \u00B7 Peloton members: VIP lane access', cap: 40, filled: 18, vip: true, featured: false }
];

const Toast = {
  show(msg) {
    let t = qs('#ph-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ph-toast';
      t.innerHTML = '<span class="dot"></span><span class="msg"></span>';
      document.body.appendChild(t);
    }
    t.querySelector('.msg').textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2600);
  }
};
