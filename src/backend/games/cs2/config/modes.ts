export const CS2_MODES = [
  { id: "competitive", label: "Competitive", defaultTeamSize: 5 },
  
  // { id: "aim", label: "1v1 Aimduel", defaultTeamSize: 1 },
];

// Lobby "type": how teams are formed and how the map is decided.
// - use_current_teams: players join teams, you pick a specific map.
// - pick_map: players join teams, captains ban maps until one remains (map veto).
// - captain_pick: captains pick players, then you choose a fixed map.
// - captain_map_veto: captains pick players, then a map veto.
export const CS2_LOBBY_MODES = [
  { id: "use_current_teams", label: "Play a Map", hint: "Players join teams, then you pick a map" },
  { id: "pick_map", label: "Map Veto", hint: "Players join teams, captains ban maps until one remains" },
  { id: "captain_pick", label: "Captain Pick", hint: "Captains pick players, then you choose a map" },
  { id: "captain_map_veto", label: "Captain Pick + Map Veto", hint: "Captains pick players, then captains ban maps" },
] as const;

export type LobbyModeId = (typeof CS2_LOBBY_MODES)[number]["id"];
