/**
 * Terjemahan Inggris registry parameter. Dipisah dari `registry.ts` agar definisi Indonesia tidak
 * berubah; `Record<ParameterKey, …>` membuat parameter baru tanpa terjemahan gagal typecheck.
 * `optionLabelsEn` sejajar dengan `options` (nilai protokol, tetap Indonesia).
 */

import type { ParameterKey } from './registry.js';

export interface ParameterEnglish {
  readonly labelEn: string;
  readonly questionEn: string;
  readonly reasonEn: string;
  readonly optionLabelsEn?: readonly string[];
}

export const PARAMETER_ENGLISH: Readonly<Record<ParameterKey, ParameterEnglish>> = {
  project_type: {
    labelEn: 'Project type',
    questionEn: 'What is the project for?',
    reasonEn: 'Determines the case profile and the relevant parameters.',
    optionLabelsEn: [
      'House',
      'Multi-storey building',
      'Housing cluster',
      'Irrigation',
      'Drainage / stormwater',
      'Culvert',
      'Pump transfer',
      'Other',
    ],
  },
  building_type: {
    labelEn: 'Building type',
    questionEn: 'What kind of building is it?',
    reasonEn: 'Usage load and scope policy.',
    optionLabelsEn: ['House', 'Boarding house', 'Light commercial', 'Industrial'],
  },
  building_floors: {
    labelEn: 'Number of floors',
    questionEn: 'How many floors does the building have?',
    reasonEn: 'Static head and risers.',
  },
  building_height: {
    labelEn: 'Building height',
    questionEn: 'Roughly how tall is the building, in meters?',
    reasonEn: 'Static pressure on upper/lower floors; pressure zoning.',
  },
  number_of_units: {
    labelEn: 'Number of units',
    questionEn: 'How many units/houses are served?',
    reasonEn: 'Peak demand of the network.',
  },
  total_area: {
    labelEn: 'Land area',
    questionEn: 'Roughly how large is the land?',
    reasonEn: 'Water demand and distribution length.',
  },
  pond_length: {
    labelEn: 'Pond length',
    questionEn: 'How many meters long is the pond?',
    reasonEn: 'Volume of water to fill and drain.',
  },
  pond_width: {
    labelEn: 'Pond width',
    questionEn: 'How many meters wide is it?',
    reasonEn: 'Volume of water to fill and drain.',
  },
  pond_depth: {
    labelEn: 'Water depth',
    questionEn: 'Roughly how deep is the water, in meters?',
    reasonEn: 'Water volume; drain pipe diameter.',
  },
  number_of_ponds: {
    labelEn: 'Number of ponds',
    questionEn: 'How many ponds are there?',
    reasonEn: 'Total flow and number of branches.',
  },
  fill_time_hours: {
    labelEn: 'Fill time',
    questionEn: 'In how many hours should the pond be full?',
    reasonEn: 'Filling flow rate, which sets the inlet pipe diameter.',
  },
  route_length: {
    labelEn: 'Route length',
    questionEn: 'Roughly how many meters is it from the water source to the destination?',
    reasonEn: 'Friction loss and pipe quantity.',
  },
  field_length: {
    labelEn: 'Field length',
    questionEn: 'How many meters long is the field?',
    reasonEn: 'Header and lateral layout.',
  },
  field_width: {
    labelEn: 'Field width',
    questionEn: 'How many meters wide is it?',
    reasonEn: 'Header and lateral layout.',
  },
  field_shape: {
    labelEn: 'Field shape',
    questionEn: 'Roughly what shape is the field?',
    reasonEn: 'Distribution length and number of branches.',
    optionLabelsEn: ['Square', 'Elongated', 'Irregular'],
  },
  terrain: {
    labelEn: 'Terrain',
    questionEn: 'Is the terrain flat, sloping, or undulating?',
    reasonEn: 'Elevation difference along the route and pressure zoning.',
    optionLabelsEn: ['Flat', 'Sloping', 'Undulating'],
  },
  terrain_slope: {
    labelEn: 'Slope',
    questionEn: 'Roughly what is the slope, in percent?',
    reasonEn: 'Gravity flow and static pressure.',
  },
  road_width: {
    labelEn: 'Road width',
    questionEn: 'How many meters wide is the road being crossed?',
    reasonEn: 'Culvert length and traffic load.',
  },
  installation_location: {
    labelEn: 'Installation location',
    questionEn: 'Where will the pipe be installed: inside the building, outside, or buried?',
    reasonEn: 'Material and class selection; external loads.',
    optionLabelsEn: ['Inside the building', 'Outside, exposed', 'Buried'],
  },
  fluid_type: {
    labelEn: 'Fluid type',
    questionEn: 'Is it clean water, rainwater, wastewater, or irrigation water?',
    reasonEn: 'Calculation method and permissible materials.',
    optionLabelsEn: ['Clean water', 'Rainwater', 'Wastewater', 'Irrigation water', 'Process fluid'],
  },
  fluid_temperature: {
    labelEn: 'Fluid temperature',
    questionEn: 'What is the temperature, in degrees?',
    reasonEn: 'Material limits (PVC is not for hot water).',
  },
  source_type: {
    labelEn: 'Water source',
    questionEn: 'Where does the water come from?',
    reasonEn: 'Available pressure and pump requirement.',
    optionLabelsEn: [
      'Municipal supply (PDAM)',
      'River / channel',
      'Well',
      'Reservoir pond',
      'Rooftop tank',
      'Ground tank',
      'Reservoir',
      'Upstream network',
    ],
  },
  source_elevation: {
    labelEn: 'Source position',
    questionEn: 'Roughly how many meters lower or higher is the water source than the destination?',
    reasonEn: 'Static head, which decides the pump and pressure.',
  },
  source_pressure: {
    labelEn: 'Source pressure',
    questionEn: 'Roughly what is the pressure at the source (bar), if known?',
    reasonEn: 'Pressure available upstream.',
  },
  source_flow_capacity: {
    labelEn: 'Source capacity',
    questionEn: 'How many liters per second can the source supply?',
    reasonEn: 'Upper limit of the design flow.',
  },
  well_depth: {
    labelEn: 'Well depth',
    questionEn: 'Roughly how deep is the well, in meters?',
    reasonEn: 'Suction and pump head.',
  },
  destination_type: {
    labelEn: 'Destination',
    questionEn: 'Where is the water delivered to?',
    reasonEn: 'Pressure required at the end point.',
    optionLabelsEn: [
      'Fixtures in a building',
      'Tank',
      'Field',
      'Reservoir',
      'Channel',
      'Downstream network',
    ],
  },
  destination_elevation: {
    labelEn: 'Destination position',
    questionEn: 'How many meters higher is the destination than the source?',
    reasonEn: 'Static head.',
  },
  required_pressure: {
    labelEn: 'Required pressure',
    questionEn: 'What pressure is needed at the end (bar), if there is a requirement?',
    reasonEn: 'Residual pressure at the farthest point.',
  },
  tank_elevation: {
    labelEn: 'Tank elevation',
    questionEn: 'At what height is the tank, in meters (or on which floor)?',
    reasonEn: 'Filling pump head and gravity pressure.',
  },
  design_flow: {
    labelEn: 'Design flow',
    questionEn: 'Roughly how much water is needed, or how many points will the system serve?',
    reasonEn: 'Basis of all sizing.',
  },
  static_head: {
    labelEn: 'Static head',
    questionEn: 'What is the elevation difference between source and destination, in meters?',
    reasonEn: 'Pump head and pressure.',
  },
  allowable_head_loss: {
    labelEn: 'Allowable head loss',
    questionEn: 'Is there a limit on pressure loss you want to respect?',
    reasonEn: 'Criterion for choosing the diameter.',
  },
  design_velocity: {
    labelEn: 'Design velocity',
    questionEn: 'Is there a flow velocity limit to follow?',
    reasonEn: 'Criterion for choosing the diameter.',
  },
  material: {
    labelEn: 'Pipe material',
    questionEn: 'Do you have a preferred pipe material?',
    reasonEn: 'Roughness, pressure class, installation method.',
    optionLabelsEn: ['PVC (uPVC)', 'HDPE', 'PPR', 'Galvanized', 'No preference yet'],
  },
  nominal_diameter: {
    labelEn: 'Nominal diameter',
    questionEn: 'What size is the pipe (if it already exists)?',
    reasonEn: 'Technical validation of the existing pipe.',
  },
  pressure_class: {
    labelEn: 'Pressure class',
    questionEn: 'What is the pipe class (if it already exists)?',
    reasonEn: 'Working pressure limit.',
    optionLabelsEn: ['AW', 'D', 'PN 6', 'PN 8', 'PN 10', 'PN 12.5', 'PN 16'],
  },
  installation_method: {
    labelEn: 'Installation method',
    questionEn: 'Will the pipe be buried, hung, or fixed to a wall?',
    reasonEn: 'External loads and joints.',
    optionLabelsEn: ['Buried', 'Hung', 'Wall-mounted', 'Above ground'],
  },
  bathrooms: {
    labelEn: 'Bathrooms',
    questionEn: 'How many bathrooms are there?',
    reasonEn: 'Fixture load units.',
  },
  basins: {
    labelEn: 'Basins',
    questionEn: 'How many washbasins are there?',
    reasonEn: 'Fixture load units.',
  },
  kitchens: {
    labelEn: 'Kitchens',
    questionEn: 'How many kitchens are there?',
    reasonEn: 'Fixture load units.',
  },
  number_of_outlets: {
    labelEn: 'Number of water points',
    questionEn: 'How many water points are there in total?',
    reasonEn: 'Design flow and branches.',
  },
  number_of_connections: {
    labelEn: 'Number of connections',
    questionEn: 'How many house/unit connections are there?',
    reasonEn: 'Peak demand of the network.',
  },
  number_of_occupants: {
    labelEn: 'Number of occupants',
    questionEn: 'Roughly how many people use the building each day (residents, staff, visitors)?',
    reasonEn: 'Daily water demand and peak flow of the building.',
  },
  bathrooms_per_floor: {
    labelEn: 'Bathrooms/toilets per floor',
    questionEn: 'How many bathrooms or toilets are there on each floor?',
    reasonEn: 'Water outlets and branch pipes on each floor.',
  },
  basins_per_floor: {
    labelEn: 'Basins per floor',
    questionEn: 'How many basins are there on each floor?',
    reasonEn: 'Water outlets and branch pipes on each floor.',
  },
  floor_area: {
    labelEn: 'Area per floor',
    questionEn: 'Roughly how many square metres is each floor?',
    reasonEn: 'Estimate of the number of occupants when it is not known.',
  },
  simultaneous_usage: {
    labelEn: 'Simultaneous usage',
    questionEn: 'Is usage mostly at the same time (morning/evening) or spread out?',
    reasonEn: 'Simultaneity factor for peak flow.',
    optionLabelsEn: ['At the same time', 'Spread out', 'Not sure'],
  },
  number_of_branches: {
    labelEn: 'Number of branches',
    questionEn: 'How many branches does the route have?',
    reasonEn: 'Layout and fittings.',
  },
  pump_required: {
    labelEn: 'Pump',
    questionEn: 'Will a pump be used?',
    reasonEn: 'Pressurized route vs gravity.',
  },
  pump_power: {
    labelEn: 'Pump power',
    questionEn: 'What is the pump rating in HP/watts (if it already exists)?',
    reasonEn: 'Validation of the existing pump duty point.',
  },
  operating_hours: {
    labelEn: 'Operating hours',
    questionEn: 'How many hours a day is it used?',
    reasonEn: 'Design flow from daily demand.',
  },
  slope: {
    labelEn: 'Channel slope',
    questionEn:
      'Roughly what is the channel slope in percent, or what is the upstream–downstream elevation difference?',
    reasonEn: 'Gravity flow capacity (Manning).',
  },
  upstream_level: {
    labelEn: 'Upstream elevation',
    questionEn: 'What is the elevation at the inlet side, in meters?',
    reasonEn: 'Slope and inlet.',
  },
  downstream_level: {
    labelEn: 'Downstream elevation',
    questionEn: 'What is the elevation at the outlet side, in meters?',
    reasonEn: 'Slope and outlet.',
  },
  pipe_fill_ratio: {
    labelEn: 'Fill ratio',
    questionEn: 'Is there a required pipe fill ratio?',
    reasonEn: 'Gravity capacity criterion.',
  },
  catchment_area: {
    labelEn: 'Catchment area',
    questionEn: 'How large is the area that drains into this channel?',
    reasonEn: 'Design rainfall flow (Q = C·I·A).',
  },
  rainfall_intensity: {
    labelEn: 'Rainfall intensity',
    questionEn: 'Is there design rainfall intensity data for the site (mm/hour)?',
    reasonEn: 'Design rainfall flow; it must not be invented.',
  },
  runoff_coefficient: {
    labelEn: 'Runoff coefficient',
    questionEn: 'Is the surface mostly concrete/asphalt, or still mostly soil/garden?',
    reasonEn: 'Coefficient C.',
  },
  return_period: {
    labelEn: 'Return period',
    questionEn: 'For what rainfall return period, in years, is it designed?',
    reasonEn: 'Choice of intensity.',
  },
  outfall_condition: {
    labelEn: 'Outfall condition',
    questionEn: 'Where does the water discharge to: city drain, river, or infiltration?',
    reasonEn: 'Outlet elevation and backwater.',
    optionLabelsEn: ['City drain', 'River', 'Infiltration', 'None yet'],
  },
  burial_depth: {
    labelEn: 'Burial depth',
    questionEn: 'How deep will the pipe be buried?',
    reasonEn: 'Soil and traffic loads.',
  },
  traffic_load: {
    labelEn: 'Traffic load',
    questionEn: 'What passes over the road: motorbikes, cars, or trucks?',
    reasonEn: 'Pipe stiffness class.',
    optionLabelsEn: ['Pedestrians / motorbikes', 'Cars', 'Trucks / heavy'],
  },
  soil_type: {
    labelEn: 'Soil type',
    questionEn: 'Is the soil hard, clay, or sandy?',
    reasonEn: 'Pipe bedding and movement risk.',
    optionLabelsEn: ['Hard', 'Clay', 'Sandy', 'Peat / soft'],
  },
  movement_risk: {
    labelEn: 'Ground movement',
    questionEn: 'Does the ground often shift or subside?',
    reasonEn: 'Choice of flexible material.',
  },
  exposed_to_sun: {
    labelEn: 'Sun exposure',
    questionEn: 'Is the pipe exposed to direct sunlight?',
    reasonEn: 'UV resistance of the material.',
  },
  irrigation_method: {
    labelEn: 'Irrigation method',
    questionEn: 'What type of irrigation is it?',
    reasonEn: 'Unit flow and pressure requirement.',
    optionLabelsEn: ['Flood / gravity', 'Sprinkler', 'Drip'],
  },
  crop_type: {
    labelEn: 'Crop',
    questionEn: 'What is the crop?',
    reasonEn: 'Crop water requirement.',
    optionLabelsEn: ['Rice', 'Secondary crops', 'Vegetables', 'Fruit / plantation'],
  },
};
