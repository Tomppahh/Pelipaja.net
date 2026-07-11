export const CS2_MODES = [
  { id: "competitive", label: "Competitive", defaultTeamSize: 5 },
  
  // { id: "aim", label: "1v1 Aimduel", defaultTeamSize: 1 },
];

// Lobby "type": how teams are formed and how the map is decided.
// - use_current_teams: players join teams, you pick a specific map.
// - pick_map: players join teams, captains ban maps until one remains (map veto).
// - captain_pick: a captain picks players, then a map veto.
// - captain_map_veto: captain pick + map veto in one flow.
export const CS2_LOBBY_MODES = [
  { id: "use_current_teams", label: "Play a Map", hint: "Pick a specific map" },
  { id: "pick_map", label: "Map Veto", hint: "Captains ban maps until one remains" },
  { id: "captain_pick", label: "Captain Pick", hint: "Captains pick players, then map veto" },
  { id: "captain_map_veto", label: "Captain Pick + Map Veto", hint: "Captain pick then map veto" },
] as const;

export type LobbyModeId = (typeof CS2_LOBBY_MODES)[number]["id"];
