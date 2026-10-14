/* ================================================================
   PelotonHub — firebase-seed.js
   Run this ONCE to populate Firestore with all seed data:
     - 31 products
     - 3 events
     - 3 promo codes
     - settings (tier discounts)
     - 31 reviews (as sub-collection of each product)
     - default admin account

   HOW TO USE:
   1. Add <script type="module" src="js/firebase-seed.js"></script>
      temporarily to any HTML page (e.g. index.html)
   2. Open that page in your browser
   3. Open DevTools → Console — you will see "✅ Seed complete!"
   4. Remove the script tag when done
   ================================================================ */

import { app, db, auth, defaultStockFor } from './firebase.js';
import {
  getFirestore,
  doc, setDoc, addDoc, collection, serverTimestamp, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── PRODUCTS ─────────────────────────────────────────────────
const PRODUCTS = [
  // Mountain Bikes
  { id:'mtb-hardtail', name:'Hardtail Trail Bike', price:42500, old_price:47000, category:'Built Bikes', sub_category:'Mountain Bikes', brand:'Specialized', in_stock:true, stock_qty:null, icon:'🚵', tag:'new', image:'img/products/hardtail-trail.jpg', short_desc:'Front suspension only — great for local trail riders.', description:'The Hardtail Trail Bike is the sweet spot for riders who want capable trail performance without the complexity of full suspension. Front suspension absorbs the bumps while the rigid rear keeps power transfer efficient on climbs.', specs:[['Frame','FACT 11m carbon chassis and rear-end, 29 S-Sizing Enduro Race Geometry, threaded BB, 170mm travel'],['Fork','RockShox Zeb Select, Charger RC damper, 15x110mm, 170mm travel'],['Drivetrain','Shimano SLX M7100, 12-speed, 10-51T cassette'],['Brakes','TRP Trail EVO, 4-piston hydraulic disc'],['Tires','Specialized Butcher, Grid Trail casing, Gripton T9, 29x2.3'],['Wheel Size','29 inch'],['Weight','16.2 kg / 35.7 lbs'],['Colors','Gloss Gunmetal / Satin Cool Grey / Redwood']], sizes:['S','M','L','XL'], default_size:'M' },
  { id:'mtb-fs-enduro', name:'Full-Suspension Enduro Bike', price:89500, old_price:null, category:'Built Bikes', sub_category:'Mountain Bikes', brand:'Trek', in_stock:true, stock_qty:null, icon:'🚵', tag:'new', image:'img/products/fs-enduro.jpg', short_desc:'Dual suspension for technical downhills.', description:'Built for riders who push into technical terrain, the Full-Suspension Enduro Bike absorbs big hits front and rear so you can carry more speed through rough lines.', specs:[['Frame','FACT 11m carbon chassis and rear-end, Enduro Race Geometry, 170mm travel'],['Fork','RockShox Zeb Select, Charger RC damper, 15x110mm, 170mm travel'],['Drivetrain','Shimano SLX M7100, 12-speed'],['Brakes','TRP Trail EVO, 4-piston hydraulic disc'],['Tires','Specialized Butcher, 29x2.3'],['Wheel Size','29 inch'],['Weight','16.2 kg / 35.7 lbs'],['Colors','Gloss Gunmetal / Satin Cool Grey / Redwood']], sizes:['S','M','L','XL'], default_size:'M' },
  { id:'mtb-xc-race', name:'Cross-Country (XC) Race Bike', price:72000, old_price:null, category:'Built Bikes', sub_category:'Mountain Bikes', brand:'Giant', in_stock:true, stock_qty:null, icon:'🚵', tag:'', image:'img/products/xc-race.jpg', short_desc:'Lightweight, built for speed on dirt tracks.', description:'Engineered for competitive cross-country racing, every gram has been scrutinized. The XC Race Bike climbs like a mountain goat and corners precisely on tight singletrack.', specs:[['Frame','Superior Aluminum Alloy, 29 inch Hardtail, tapered head tube'],['Fork','SR Suntour XCR, Air, 100mm travel, 15mm thru-axle'],['Drivetrain','Shimano Deore, 1x10-speed, 11-46T cassette'],['Brakes','Shimano MT200, hydraulic disc, 180mm front / 160mm rear'],['Tires','Schwalbe Smart Sam 29x2.25'],['Wheel Size','29 inch'],['Weight','14.5 kg'],['Colors','Matte Black / White']], sizes:['XS','S','M','L'], default_size:'M' },
  { id:'mtb-emtb', name:'Electric Mountain Bike (e-MTB)', price:125000, old_price:null, category:'Built Bikes', sub_category:'Mountain Bikes', brand:'Trek', in_stock:false, stock_qty:null, icon:'🚵', tag:'new', image:'img/products/emtb.jpg', short_desc:'Pedal-assist for tackling steep climbs.', description:'The e-MTB opens up longer, steeper rides to a wider range of fitness levels. Bosch motor integration keeps the weight distribution natural while the 625Wh battery covers a full day of trail riding.', specs:[['Frame','Specialized M5 alloy, 150mm custom-tuned rear travel'],['Fork','FOX 36 Performance, 160mm travel'],['Motor','Specialized Turbo Full Power 2.2, 90Nm torque, 565W'],['Drivetrain','SRAM GX Eagle, 12-speed, 10-52T cassette'],['Brakes','SRAM DB8, 4-piston hydraulic disc, 200mm rotors'],['Tires','Specialized Butcher Grid Trail T9, 29x2.3 front'],['Wheel Size','29 inch front / 27.5 inch rear (mixed)'],['Weight','23.79 kg'],['Colors','Satin Harvest Gold / Tarmac Black']], sizes:['S','M','L','XL'], default_size:'M' },
  { id:'mtb-fat', name:'Fat-Tire Trail Bike', price:38500, old_price:42000, category:'Built Bikes', sub_category:'Mountain Bikes', brand:'Giant', in_stock:true, stock_qty:null, icon:'🚵', tag:'sale', image:'img/products/fat-tire.jpg', short_desc:'Extra-wide 4.8 inch tires for sand, snow, rocks, and roots.', description:'The Fat-Tire Trail Bike is built for riders who refuse to let terrain decide where they go. Its oversized tires roll over sand, snow, mud, and rocky singletrack with equal confidence.', specs:[['Frame','Aluminum'],['Fork','Kona Woo Fat Carbon'],['Drivetrain','Shimano Deore 12-speed (11-51T)'],['Brakes','Shimano MT410 Hydraulic Disc'],['Tires','26 x 4.8 inch Tubeless-Ready'],['Wheel Size','26 in'],['Weight','33 lb (15 kg)'],['Colors','Matte Pewter Green / Dark Teal']], sizes:['S','M','L'], default_size:'M' },
  // Road & Gravel Bikes
  { id:'road-aero', name:'Carbon Fiber Aero Road Bike', price:165000, old_price:null, category:'Built Bikes', sub_category:'Road & Gravel Bikes', brand:'Trek', in_stock:false, stock_qty:null, icon:'🚴', tag:'new', image:'img/products/carbon-aero-road.jpg', short_desc:'Built strictly for high-speed pavement riding.', description:'Every tube profile, cable routing choice, and component spec on this carbon aero road bike has been optimized for raw speed on smooth pavement.', specs:[['Frame','Canyon Aeroad CFR Carbon, 12x142mm thru-axle, internal routing'],['Fork','Canyon FK0137 CF Disc Carbon, 12x100mm thru-axle'],['Drivetrain','SRAM RED AXS 12-speed electronic'],['Brakes','SRAM RED AXS Hydraulic Disc'],['Tires','Continental Grand Prix 5000 S TR, 700x28c'],['Wheel Size','700c'],['Weight','6.9 kg / 15.2 lbs'],['Colors','Pro Black, Crystal White']], sizes:['XS','S','M','L','XL'], default_size:'M' },
  { id:'road-endurance', name:'Endurance Road Bike', price:68000, old_price:null, category:'Built Bikes', sub_category:'Road & Gravel Bikes', brand:'Giant', in_stock:true, stock_qty:null, icon:'🚴', tag:'', image:'img/products/endurance-road.jpg', short_desc:'Designed for comfort over long-distance road events.', description:'The endurance geometry puts you in a slightly upright, relaxed position that pays dividends on 100km+ charity rides.', specs:[['Frame','FACT 10R, Rider First Engineered, threaded BB, 12x142mm thru-axle'],['Fork','Future Shock 3.2, FACT Carbon, 12x100mm thru-axle'],['Drivetrain','SRAM Rival eTAP AXS, 12-speed'],['Brakes','SRAM Rival Hydraulic Disc, 160mm'],['Tires','S-Works Mondo 2BR, 700x32c'],['Wheel Size','700c'],['Weight','8.62 kg'],['Colors','Gloss Sea Foam / Violet / Pearl']], sizes:['XS','S','M','L','XL'], default_size:'M' },
  { id:'road-gravel', name:'All-Road Gravel Bike', price:58000, old_price:null, category:'Built Bikes', sub_category:'Road & Gravel Bikes', brand:'Giant', in_stock:true, stock_qty:null, icon:'🚴', tag:'', image:'img/products/all-road-gravel.jpg', short_desc:'Versatile build for swapping between pavement and dirt roads.', description:'Gravel bikes are the Swiss army knife of cycling. Wide tire clearance and a stable geometry make this equally at home on Metro Manila traffic and gravel roads outside the city.', specs:[['Frame','500 Series OCLV Carbon, Rear IsoSpeed, internal frame storage'],['Fork','Domane SL Carbon, 12x100mm thru-axle'],['Drivetrain','Shimano 105 R7100 Di2 12-speed'],['Brakes','Shimano 105 Hydraulic Disc, 160mm RT70 centerlock rotors'],['Tires','Bontrager R3 Hard-Case Lite TLR, 700x32c'],['Wheel Size','700c'],['Weight','8.9 kg / 19.6 lbs'],['Colors','Satin Trek Black']], sizes:['XS','S','M','L','XL'], default_size:'M' },
  { id:'road-bikepacking', name:'Bikepacking Adventure Bike', price:52000, old_price:null, category:'Built Bikes', sub_category:'Road & Gravel Bikes', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🚴', tag:'', image:'img/products/bikepacking.jpg', short_desc:'Steel frame with multiple mounts for heavy gear bags.', description:'Built for multi-day adventure rides, this steel bikepacking frame soaks up road buzz on long days while its numerous bag and rack mounts handle the weight of your overnight kit.', specs:[['Frame','Triple-butted CroMoly Steel, Alternator flat-mount dropouts'],['Fork','Firestarter Carbon Deluxe, three-pack cargo mounts'],['Drivetrain','Shimano GRX RX610 / RX810, 1x12-speed'],['Brakes','TRP Spyre-C / Shimano GRX Hydraulic Disc'],['Tires','Maxxis Rekon 29x2.6'],['Wheel Size','29 inch'],['Weight','11.8 kg / 26.0 lbs'],['Colors','Moss Green, Gold, Red-Orange']], sizes:['XS','S','M','L','XL'], default_size:'M' },
  { id:'road-cyclocross', name:'Cyclocross Race Bike', price:75000, old_price:null, category:'Built Bikes', sub_category:'Road & Gravel Bikes', brand:'Trek', in_stock:false, stock_qty:null, icon:'🚴', tag:'new', image:'img/products/cyclocross.jpg', short_desc:'Agile geometry engineered for muddy closed-circuit racing.', description:'Cyclocross geometry demands a bike that can accelerate hard out of corners, survive dismounts, and stay rideable in thick mud.', specs:[['Frame','Canyon Inflite CF SLX Carbon, 12x142mm'],['Fork','Canyon FK0045 CF Disc Carbon, 12x100mm'],['Drivetrain','SRAM Force AXS / Shimano Ultegra Di2, 1x12-speed'],['Brakes','Hydraulic Disc, 160mm front / 140mm rear'],['Tires','Schwalbe X-One Allround TLE, 700x33c'],['Wheel Size','700c'],['Weight','7.8 kg / 17.1 lbs'],['Colors','Aurora']], sizes:['XS','S','M','L'], default_size:'M' },
  // Urban & Commuter
  { id:'urban-stepthrough', name:'Step-Through City Commuter', price:18500, old_price:null, category:'Built Bikes', sub_category:'Urban & Commuter Bikes', brand:'Giant', in_stock:true, stock_qty:null, icon:'🚲', tag:'', image:'img/products/step-through.jpg', short_desc:'Practical everyday bike with rear rack and fenders.', description:'A step-through frame makes mounting and dismounting easy in work clothes or a dress. The included rear rack and fenders mean you arrive at the office clean and ready.', specs:[['Frame','Specialized A1 Premium Aluminum, Low-Entry design'],['Fork','Formed Steel Hi-Ten Tubes, disc brake mount'],['Drivetrain','microSHIFT RD-M26S, 1x7-speed'],['Brakes','Tektro Mechanical Disc, 160mm rotors'],['Tires','Specialized Nimbus II Sport, 650b x 2.3'],['Wheel Size','650b (27.5 inch)'],['Weight','13.2 kg / 29.0 lbs'],['Colors','Blue']], sizes:['One Size'], default_size:'One Size' },
  { id:'urban-fixie', name:'Fixie / Single-Speed Street Bike', price:14500, old_price:null, category:'Built Bikes', sub_category:'Urban & Commuter Bikes', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🚲', tag:'', image:'img/products/fixie.jpg', short_desc:'Low-maintenance, lightweight urban ride.', description:'One gear, two options — ride fixed or flip to freewheel. Less to maintain, less to break.', specs:[['Frame','Durable 4130 Grade High-Tensile Steel'],['Fork','High-Tensile Steel fork'],['Drivetrain','Single Speed / Fixed Gear, flip-flop hub, 44x16 ratio'],['Brakes','Dual-Pivot Caliper Rim Brakes (front & rear)'],['Tires','Kenda 700x28c'],['Wheel Size','700c (40mm Deep-V Rims)'],['Weight','11.1 kg / 24.5 lbs'],['Colors','Rigby (Navy/Creme), Wulf (Matte Black), Earthstone']], sizes:['XS','S','M','L'], default_size:'M' },
  { id:'urban-folding', name:'Folding Compact Bike', price:22000, old_price:null, category:'Built Bikes', sub_category:'Urban & Commuter Bikes', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🚲', tag:'', image:'img/products/folding.jpg', short_desc:'Ideal for multi-modal commuters taking the train or bus.', description:'Folds in under 15 seconds and fits in a locker, under a desk, or in an MRT overhead rack.', specs:[['Frame','Hand-brazed heat-treated steel main frame and rear frame'],['Fork','Steel brazed fork'],['Drivetrain','Brompton 2, 6, or 12-speed internal hub & derailleur hybrid'],['Brakes','Brompton Dual-Pivot Caliper Brakes'],['Tires','Schwalbe Marathon Racer, 349x35c (16x1-3/8)'],['Wheel Size','16 inch (349mm)'],['Weight','11.3-12.1 kg'],['Colors','Plum Red']], sizes:['One Size'], default_size:'One Size' },
  { id:'urban-e-commuter', name:'Class 3 Electric Commuter Bike', price:68000, old_price:null, category:'Built Bikes', sub_category:'Urban & Commuter Bikes', brand:'Trek', in_stock:false, stock_qty:null, icon:'🚲', tag:'new', image:'img/products/e-commuter.jpg', short_desc:'High-speed pedal assist up to 45kph for fast city transits.', description:'Class 3 assist kicks you up to 45kph so you can keep pace with traffic and skip the LRT.', specs:[['Frame','E5 Premium Aluminum, integrated downtube battery, internal routing'],['Fork','SR Suntour Mobie34 AIR, 80mm travel, thru-axle'],['Drivetrain','SRAM GX 11-speed / Shimano CUES 11-speed'],['Brakes','SRAM DB8 / Shimano 4-piston hydraulic disc, 180mm rotors'],['Tires','Pathfinder Sport Reflect, 650b x 2.3'],['Wheel Size','650b (27.5 inch)'],['Weight','25.3 kg / 55.7 lbs'],['Colors','Gloss Silver Dust / Gloss Amethyst']], sizes:['S','M','L'], default_size:'M' },
  { id:'urban-cargo', name:'Heavy-Duty Electric Cargo Bike', price:95000, old_price:null, category:'Built Bikes', sub_category:'Urban & Commuter Bikes', brand:'Trek', in_stock:false, stock_qty:null, icon:'🚲', tag:'new', image:'img/products/cargo-ebike.jpg', short_desc:'Extended racks for groceries or deliveries.', description:'Built to haul, the cargo e-bike carries up to 100kg of payload across front and rear extended racks while the motor keeps the whole rig feeling nimble in traffic.', specs:[['Frame','6061 Aluminum, patented MultiTruss design'],['Fork','Custom SR Suntour, Chromoly steerer, 34mm stanchions, thru-axle'],['Drivetrain','Shimano Deore Shadow+ 1x10-speed, Bosch Cargo Line 85Nm motor'],['Brakes','Magura MT-C ABS, 4-piston hydraulic disc, 203mm rotors'],['Tires','Schwalbe Pick-Up Cargo-Optimized, 20x2.4'],['Wheel Size','20 inch'],['Weight','37.3 kg / 82.3 lbs'],['Colors','Tidal Blue']], sizes:['One Size'], default_size:'One Size' },
  // Drivetrain & Components
  { id:'comp-cassette', name:'12-Speed Cassette', price:4800, old_price:null, category:'Bike Parts & Accessories', sub_category:'Drivetrain & Components', brand:'Shimano', in_stock:true, stock_qty:null, icon:'⚙️', tag:'', image:'img/products/cassette.webp', short_desc:'High-performance rear gear cluster replacement.', description:'A direct-fit replacement cassette for most 12-speed MTB drivetrains.', specs:[['Speeds','12-speed'],['Range','10-51T'],['Compatibility','Shimano HG+, SRAM XD with adapter'],['Weight','385 g']], sizes:null, default_size:null },
  { id:'comp-brake-set', name:'Hydraulic Disc Brake Caliper & Lever Set', price:8500, old_price:null, category:'Bike Parts & Accessories', sub_category:'Drivetrain & Components', brand:'Shimano', in_stock:true, stock_qty:null, icon:'🔧', tag:'', image:'img/products/disc-brake.jpg', short_desc:'Premium stopping power upgrade.', description:'Hydraulic disc brakes offer significantly more modulation and power than cable-actuated alternatives. Includes levers, calipers, rotors, and all mounting hardware.', specs:[['Type','Hydraulic disc'],['Rotors','180mm front, 160mm rear'],['Lever Reach','Tool-free reach adjust'],['Compatibility','Post mount & flat mount adapters included'],['Weight','640 g (pair)']], sizes:null, default_size:null },
  { id:'comp-wheelset', name:'Tubeless-Ready Carbon Wheelset', price:32000, old_price:36000, category:'Bike Parts & Accessories', sub_category:'Drivetrain & Components', brand:'SRAM', in_stock:true, stock_qty:null, icon:'🛞', tag:'sale', image:'img/products/carbon-wheelset.jpg', short_desc:'Lightweight wheel upgrade for road or gravel.', description:'Stiff, light, and tubeless-ready out of the box, these carbon wheels transform the feel of any road or gravel bike.', specs:[['Rim Material','Carbon fiber'],['Internal Width','21mm'],['Hub','DT Swiss 350 internals'],['Compatibility','Road / Gravel 700c'],['Weight','1,380 g (pair)']], sizes:null, default_size:null },
  { id:'comp-saddle', name:'Ergonomic Gel Saddle', price:2800, old_price:null, category:'Bike Parts & Accessories', sub_category:'Drivetrain & Components', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🪑', tag:'', image:'img/products/gel-saddle.jpg', short_desc:'Comfort upgrade for long endurance charity rides.', description:'Gel padding in the sit-bone zone takes the sting out of marathon charity event routes.', specs:[['Padding','Multi-density gel foam'],['Rail','Chromoly'],['Width','142mm, 155mm options'],['Weight','310 g']], sizes:null, default_size:null },
  { id:'comp-pedals', name:'Clipless Road Pedals', price:5200, old_price:null, category:'Bike Parts & Accessories', sub_category:'Drivetrain & Components', brand:'Shimano', in_stock:true, stock_qty:null, icon:'⚙️', tag:'', image:'img/products/clipless-pedals.jpg', short_desc:'High-efficiency pedals for competitive and avid road cyclists.', description:'SPD-SL compatible clipless pedals with a large platform for power transfer and a wide float adjustment.', specs:[['Type','Clipless (SPD-SL compatible)'],['Platform','Composite body, stainless steel axle'],['Float','0, 2, 6 degree cleat options'],['Weight','248 g (pair)']], sizes:null, default_size:null },
  // Safety & Rider Gear
  { id:'gear-helmet', name:'MIPS Integrated Bicycle Helmet', price:4500, old_price:5200, category:'Bike Parts & Accessories', sub_category:'Safety & Rider Gear', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🪖', tag:'', image:'img/products/mips-helmet.jpg', short_desc:'Advanced rotational impact protection technology.', description:'MIPS technology adds a low-friction layer inside the helmet that moves independently during an angled impact, reducing rotational force on the brain.', specs:[['Protection','MIPS rotational impact liner'],['Ventilation','20 channels'],['Weight','280 g'],['Sizes','S / M / L'],['Certification','CPSC, EN 1078']], sizes:['S','M','L'], default_size:'M' },
  { id:'gear-headlight', name:'1200-Lumen Rechargeable Smart Headlight', price:3200, old_price:null, category:'Bike Parts & Accessories', sub_category:'Safety & Rider Gear', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'💡', tag:'new', image:'img/products/headlight.webp', short_desc:'High-visibility light for night riding and daily commuting.', description:'Twelve hundred lumens is enough to light a completely unlit provincial road at speed. Smart auto-brightness mode adjusts output to ambient light.', specs:[['Output','1200 lumens max'],['Modes','Smart auto, High, Medium, Low, Flash'],['Battery','USB-C, 90-minute full charge, 8-hour runtime (medium)'],['Mount','GoPro-compatible quick-release'],['Rating','IPX6']], sizes:null, default_size:null },
  { id:'gear-bib-shorts', name:'Padded Cycling Bib Shorts', price:2400, old_price:null, category:'Bike Parts & Accessories', sub_category:'Safety & Rider Gear', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🩲', tag:'', image:'img/products/bib-shorts.jpg', short_desc:'Essential comfort gear for long charity event routes.', description:'Anatomically shaped 8mm chamois padding and flatlock stitching eliminate pressure points and saddle soreness on rides that stretch past three hours.', specs:[['Chamois','8mm multi-density foam'],['Material','Compression lycra with mesh panels'],['Grippers','Wide silicone leg grippers'],['Sizes','XS-XXL'],['UPF','50+']], sizes:['XS','S','M','L','XL','XXL'], default_size:'M' },
  { id:'gear-jacket', name:'High-Visibility Windproof Cycling Jacket', price:3600, old_price:null, category:'Bike Parts & Accessories', sub_category:'Safety & Rider Gear', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🧥', tag:'', image:'img/products/cycling-jacket.jpg', short_desc:'Reflective apparel for adverse weather riding.', description:'360-degree reflective elements make you visible from every angle on early-morning and night rides.', specs:[['Shell','Windproof, water-resistant DWR coating'],['Reflectivity','360 degree retroreflective strips'],['Pockets','2 rear + 1 zipped chest'],['Sizes','XS-XXL'],['Pack','Packs into rear pocket']], sizes:['XS','S','M','L','XL','XXL'], default_size:'M' },
  { id:'gear-gloves', name:'Touchscreen-Compatible Cycling Gloves', price:980, old_price:null, category:'Bike Parts & Accessories', sub_category:'Safety & Rider Gear', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🧤', tag:'', image:'img/products/cycling-gloves.jpg', short_desc:'Full-finger protection with mobile device usability.', description:'Touchscreen-compatible fingertips mean you can navigate Strava or answer a call without pulling off your gloves.', specs:[['Material','Synthetic leather palm, stretch fleece back'],['Fingertips','Touchscreen-compatible'],['Palm Padding','Gel padding on heel of palm'],['Closure','Velcro wrist strap'],['Sizes','S-XL']], sizes:['S','M','L','XL'], default_size:'M' },
  // On-Bike Storage & Maintenance
  { id:'maint-frame-bag', name:'Bikepacking Frame Bag', price:1800, old_price:null, category:'Bike Parts & Accessories', sub_category:'On-Bike Storage & Maintenance', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'👜', tag:'', image:'img/products/frame-bag.jpg', short_desc:"Water-resistant bag fits inside your bike's main triangle.", description:'Zip your tubes, tools, snacks, and a phone charger into the main triangle of your bike frame. Weather-resistant fabric keeps contents dry in light rain.', specs:[['Material','900D polyester, PU coated'],['Capacity','2.5L'],['Mounting','Velcro straps, no frame contact damage'],['Waterproof','Splash resistant'],['Compatibility','Most road, gravel, and MTB frames']], sizes:null, default_size:null },
  { id:'maint-u-lock', name:'Heavy-Duty U-Lock', price:1200, old_price:null, category:'Bike Parts & Accessories', sub_category:'On-Bike Storage & Maintenance', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🔒', tag:'', image:'img/products/u-lock.jpg', short_desc:'Tough shackle lock for urban bike parking.', description:'A hardened steel shackle and reinforced lock body resist bolt cutters and angle grinders long enough to deter casual theft in urban environments.', specs:[['Shackle','13mm hardened boron-manganese steel'],['Body','Reinforced steel body'],['Keys','3 keys included (1 LED key)'],['Weight','1.1 kg'],['Dimensions','Internal: 9.5cm x 16cm']], sizes:null, default_size:null },
  { id:'maint-floor-pump', name:'Pro Floor Pump with Gauge', price:890, old_price:null, category:'Bike Parts & Accessories', sub_category:'On-Bike Storage & Maintenance', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🪣', tag:'', image:'img/products/floor-pump.jpg', short_desc:'Accurate high-pressure floor pump for road and mountain tires.', description:'A large-barrel steel floor pump with a dual-head nozzle covers Presta and Schrader valves. The gauge reads up to 220 psi — more than enough for any road tire.', specs:[['Max Pressure','220 psi / 15.2 bar'],['Gauge','Analog dual-scale'],['Valve','Dual head: Presta + Schrader'],['Barrel','Steel'],['Hose','Flexible 57cm hose with locking chuck']], sizes:null, default_size:null },
  { id:'maint-multitool', name:'11-Function Bike Multi-Tool', price:650, old_price:null, category:'Bike Parts & Accessories', sub_category:'On-Bike Storage & Maintenance', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🔧', tag:'', image:'img/products/multitool.jpg', short_desc:'Compact trail toolkit that fits in a jersey pocket.', description:'Eleven tools in a package that weighs almost nothing. Covers every adjustment you are likely to need in the middle of a ride.', specs:[['Functions','11'],['Includes','2,2.5,3,4,5,6mm hex keys; T25 Torx; flat & Phillips screwdrivers; chain tool'],['Material','Stainless steel'],['Weight','108 g']], sizes:null, default_size:null },
  { id:'maint-tubeless-kit', name:'Tubeless Conversion Kit', price:1400, old_price:null, category:'Bike Parts & Accessories', sub_category:'On-Bike Storage & Maintenance', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🛞', tag:'', image:'img/products/tubeless-kit.jpg', short_desc:'Convert any rim-strip wheel to tubeless for a smoother ride.', description:'Lower pressure, more traction, self-sealing punctures. A tubeless setup transforms how your bike feels on both road and gravel.', specs:[['Rim Tape Width','25mm and 33mm rolls (4m each)'],['Valves','2x Presta valves, 40mm, alloy'],['Sealant','120ml for initial setup'],['Compatibility','Road, Gravel, MTB wheels (27.5 / 29 / 700c)']], sizes:null, default_size:null },
  { id:'maint-lever-set', name:'Tire Lever Set (3-Pack)', price:180, old_price:null, category:'Bike Parts & Accessories', sub_category:'On-Bike Storage & Maintenance', brand:'PelotonHub', in_stock:true, stock_qty:null, icon:'🔧', tag:'', image:'img/products/lever-set.jpg', short_desc:'Essential for changing tubes on the road.', description:'Three nylon tire levers with a notched hook that grabs the bead securely without slipping or damaging the rim. A must-have in every saddle bag.', specs:[['Material','Glass-filled nylon'],['Quantity','3 levers per set'],['Profile','Slim, easy to slip under bead'],['Rim Safety','Rim-friendly profile (does not scratch alloy or carbon)']], sizes:null, default_size:null },
];

// ── REVIEWS ───────────────────────────────────────────────────
const REVIEWS = [
  { product_id:'mtb-hardtail',    author:'Rider A — Verified',        rating:5, body:'Best trail bike at this price. Geometry is spot on.' },
  { product_id:'mtb-fs-enduro',   author:'Rider B — Peloton Member',  rating:5, body:'Handles the gnarliest descents with total confidence.' },
  { product_id:'mtb-xc-race',     author:'Rider C — Chain Member',    rating:5, body:'Shaved two minutes off my personal best on the XC loop.' },
  { product_id:'mtb-emtb',        author:'Rider D — Verified',        rating:5, body:'Made our local mountain trail accessible again after my knee surgery.' },
  { product_id:'mtb-fat',         author:'Rider E — Spoke Member',    rating:4, body:'Beach trail rides feel totally different on fat tires. So much fun.' },
  { product_id:'road-aero',       author:'Rider F — Peloton Member',  rating:5, body:'Fastest bike I have ever ridden. Di2 shifts are instant.' },
  { product_id:'road-endurance',  author:'Rider G — Chain Member',    rating:5, body:'Finished a 120km charity ride and my back felt fine. This bike just works.' },
  { product_id:'road-gravel',     author:'Rider H — Verified',        rating:5, body:'Rode pavement to dirt and back without stopping to adjust anything.' },
  { product_id:'road-bikepacking',author:'Rider I — Peloton Member',  rating:5, body:'Toured the Bataan Peninsula fully loaded. Handled every km without complaint.' },
  { product_id:'road-cyclocross', author:'Rider J — Verified',        rating:5, body:'Podium-ready right out of the box. Handling is razor sharp.' },
  { product_id:'urban-stepthrough',author:'Rider K — Spoke Member',   rating:5, body:'Getting on and off in my work skirt is a breeze. Highly recommend for city riding.' },
  { product_id:'urban-fixie',     author:'Rider L — Verified',        rating:4, body:'Light and responsive. Exactly what I wanted for my BGC commute.' },
  { product_id:'urban-folding',   author:'Rider M — Chain Member',    rating:5, body:'Takes the train to work and cycles the last mile. Total game-changer.' },
  { product_id:'urban-e-commuter',author:'Rider N — Verified',        rating:5, body:'Commute from Marikina to Makati in 35 minutes flat. Worth every peso.' },
  { product_id:'urban-cargo',     author:'Rider O — Peloton Member',  rating:5, body:'Running daily grocery deliveries. Motor handles full loads on EDSA bridges easily.' },
  { product_id:'comp-cassette',   author:'Rider P — Verified',        rating:5, body:'Shifting is crisp and consistent. Perfect replacement.' },
  { product_id:'comp-brake-set',  author:'Rider Q — Chain Member',    rating:5, body:'Night and day difference over my old cable brakes. One-finger stopping power.' },
  { product_id:'comp-wheelset',   author:'Rider R — Peloton Member',  rating:5, body:'Bike feels 2kg lighter with these on. Rolling resistance is noticeably lower.' },
  { product_id:'comp-saddle',     author:'Rider S — Spoke Member',    rating:4, body:'Switched from a racing saddle and the difference on long rides is huge.' },
  { product_id:'comp-pedals',     author:'Rider T — Chain Member',    rating:5, body:'Smooth engagement and release. Great value for the price.' },
  { product_id:'gear-helmet',     author:'Rider U — Verified',        rating:5, body:'Fits perfectly and the MIPS gives real peace of mind on fast descents.' },
  { product_id:'gear-headlight',  author:'Rider V — Chain Member',    rating:5, body:'Lights up my entire night commute like daylight. Smart mode works perfectly.' },
  { product_id:'gear-bib-shorts', author:'Rider W — Peloton Member',  rating:5, body:'Rode 160km with zero chafing. The chamois quality is excellent.' },
  { product_id:'gear-jacket',     author:'Rider X — Chain Member',    rating:4, body:'Kept me dry in a surprise rain shower and drivers actually see me now.' },
  { product_id:'gear-gloves',     author:'Rider Y — Verified',        rating:5, body:'Warm and grippy. Phone screen still responds perfectly through the fingertips.' },
  { product_id:'maint-frame-bag', author:'Rider Z — Spoke Member',    rating:5, body:'Fits my medium frame perfectly. Keeps everything dry and accessible.' },
  { product_id:'maint-u-lock',    author:'Rider AA — Verified',       rating:4, body:'Solid and heavy. Makes me confident leaving my bike outside.' },
  { product_id:'maint-floor-pump',author:'Rider BB — Chain Member',   rating:5, body:'Accurate gauge and the dual valve head saves time.' },
  { product_id:'maint-multitool', author:'Rider CC — Peloton Member', rating:5, body:'Saved my ride twice already. Never leaving home without it.' },
  { product_id:'maint-tubeless-kit',author:'Rider DD — Verified',     rating:5, body:'Setup was straightforward. No punctures since converting.' },
  { product_id:'maint-lever-set', author:'Rider EE — Spoke Member',   rating:4, body:'Cheap and works perfectly. No more pinched tubes.' },
];

// ── EVENTS ────────────────────────────────────────────────────
const EVENTS = [
  { id:'mtn-ride',     title:'Sunday Mountain Ride',       kicker:'Group Ride',   dist:'25km', event_date:'2026-08-10', description:'Join us for our weekly Sunday ride through the forested trails north of the city. All fitness levels welcome — we ride as a group and no one gets left behind.', capacity:50, filled:32, is_vip:false, featured:true  },
  { id:'charity-ride', title:'Bikes for Kids Charity Ride',kicker:'Charity Ride', dist:'15km', event_date:'2026-08-17', description:'Raise funds for underprivileged children while riding through the city. Every peso collected goes directly to Bikes for Kids PH. Helmet and safety gear required.', capacity:100, filled:67, is_vip:false, featured:true  },
  { id:'night-ride',   title:'Urban Night Ride',           kicker:'Night Ride',   dist:'18km', event_date:'2026-08-24', description:'Experience the city in a completely different light — literally. Lights and reflective gear are mandatory. After-ride coffee stop at the usual spot.', capacity:40,  filled:18, is_vip:true,  featured:false },
];

// ── PROMO CODES ───────────────────────────────────────────────
const PROMOS = [
  { code:'SPOKE10',   discount:10, active:true },
  { code:'RIDE2026',  discount:15, active:true },
  { code:'NEWMEMBER', discount:5,  active:true },
];

// ── SEED FUNCTION ─────────────────────────────────────────────
async function seed() {
  console.log('🌱 Starting PelotonHub Firestore seed...');
  const BATCH_SIZE = 400; // Firestore batch limit is 500 operations

  // ── Admin account (first) ─────────────────────────────────────
  // Creates admin@pelotonhub.ph / admin123 in Firebase Auth + admins/{uid} doc,
  // and stays signed in as that admin: the security rules only let an admin
  // write products, events, promo codes and settings.
  console.log('  → Signing in as admin (admin@pelotonhub.ph / admin123)...');
  const fbAuth = getAuth();
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(fbAuth, 'admin@pelotonhub.ph', 'admin123');
    console.log('     ✓ Admin account created');
  } catch (e) {
    if (e.code !== 'auth/email-already-in-use') throw e;
    cred = await signInWithEmailAndPassword(fbAuth, 'admin@pelotonhub.ph', 'admin123');
    console.log('     ℹ Admin account already exists — signed in');
  }
  await setDoc(doc(db, 'admins', cred.user.uid), {
    name:       'Shop Admin',
    email:      'admin@pelotonhub.ph',
    created_at: serverTimestamp(),
  });
  console.log('     ✓ Admin record written');

  // ── Products (with sub-collection reviews) ─────────────────
  console.log('  → Writing products...');
  let batch = writeBatch(db);
  let opCount = 0;

  for (const p of PRODUCTS) {
    const { id, ...data } = p;
    batch.set(doc(db, 'products', id), {
      ...data,
      // Firestore can't store arrays inside arrays, so the [key, value] pairs go in as JSON text
      specs:      JSON.stringify(data.specs || []),
      stock_qty:  data.in_stock ? defaultStockFor(data.category, data.sub_category) : 0,
      deleted:    false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    opCount++;
    if (opCount >= BATCH_SIZE) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
  }
  if (opCount > 0) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
  console.log(`     ✓ ${PRODUCTS.length} products written`);

  // ── Reviews (sub-collection) ────────────────────────────────
  console.log('  → Writing reviews...');
  for (const r of REVIEWS) {
    const ref = doc(collection(db, 'products', r.product_id, 'reviews'));
    batch.set(ref, {
      author:     r.author,
      rating:     r.rating,
      body:       r.body,
      user_id:    null,
      created_at: serverTimestamp(),
    });
    opCount++;
    if (opCount >= BATCH_SIZE) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
  }
  if (opCount > 0) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
  console.log(`     ✓ ${REVIEWS.length} reviews written`);

  // ── Events ──────────────────────────────────────────────────
  console.log('  → Writing events...');
  for (const e of EVENTS) {
    const { id, ...data } = e;
    batch.set(doc(db, 'events', id), {
      ...data,
      deleted:    false,
      created_at: serverTimestamp(),
    });
    opCount++;
  }
  if (opCount > 0) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
  console.log(`     ✓ ${EVENTS.length} events written`);

  // ── Promo codes ─────────────────────────────────────────────
  console.log('  → Writing promo codes...');
  for (const p of PROMOS) {
    batch.set(doc(db, 'promo_codes', p.code), { discount: p.discount, active: p.active });
    opCount++;
  }
  if (opCount > 0) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
  console.log(`     ✓ ${PROMOS.length} promo codes written`);

  // ── Settings ─────────────────────────────────────────────────
  console.log('  → Writing settings...');
  await setDoc(doc(db, 'config', 'settings'), {
    tier_discount_Spoke:   5,
    tier_discount_Chain:   10,
    tier_discount_Peloton: 20,
  });
  console.log('     ✓ Settings written');

  console.log('✅ Seed complete! Remove this script tag from your HTML now.');
}

seed().catch(err => console.error('❌ Seed failed:', err));
