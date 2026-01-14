const S2_DATA = {
    compactData: [
        ["Kenesu", "Oguri Cap (Christmas)", 1, "2600m Turf (R)", "S2-1", "Oguri Cap", "Christmas", 5],
        ["HoriYon", "Oguri Cap (Christmas)", 0, "2600m Turf (R)", "S2-1", "Oguri Cap", "Christmas", 5],
        ["Bunsen", "Special Week (Original)", 1, "2600m Turf (R)", "S2-1", "Special Week", "Original", 10],
        ["KN", "Mayano Top Gun (Wedding)", 0, "2600m Turf (R)", "S2-1", "Mayano Top Gun", "Wedding", 5],
        ["Pines", "Mihono Bourbon (Original)", 0, "2600m Turf (R)", "S2-1", "Mihono Bourbon", "Original", 10],
        ["Mixsy", "Grass Wonder (Original)", 1, "2600m Turf (R)", "S2-1", "Grass Wonder", "Original", 5],
        ["Jedmumu", "Tokai Teio (Anime)", 1, "2600m Turf (R)", "S2-1", "Tokai Teio", "Anime", 5],
        ["Draguin", "Mejiro Dober (Original)", 1, "2600m Turf (R)", "S2-1", "Mejiro Dober", "Original", 10],
        ["Nymaera", "Mayano Top Gun (Wedding)", 0, "2600m Turf (R)", "S2-1", "Mayano Top Gun", "Wedding", 5],
        ["Eva", "Narita Brian (Original)", 3, "2600m Turf (R)", "S2-1", "Narita Brian", "Original", 10],
        ["Spyder", "Oguri Cap (Original)", 1, "2600m Turf (R)", "S2-1", "Oguri Cap", "Original", 10],
        ["Raccoon", "Oguri Cap (Original)", 3, "2600m Turf (R)", "S2-1", "Oguri Cap", "Original", 10],
        ["FuHua", "Narita Taishin (Original)", 2, "2600m Turf (R)", "S2-1", "Narita Taishin", "Original", 10],
        ["Boop", "Hishi Amazon (Original)", 0, "2600m Turf (R)", "S2-1", "Hishi Amazon", "Original", 10],
        ["Synocra", "Grass Wonder (Original)", 0, "2600m Turf (R)", "S2-1", "Grass Wonder", "Original", 5],
        ["Teki", "Grass Wonder (Original)", 0, "2600m Turf (R)", "S2-1", "Grass Wonder", "Original", 5],
        ["MetaHayato", "Oguri Cap (Original)", 1, "2600m Turf (R)", "S2-1", "Oguri Cap", "Original", 10],
        ["Roidee", "Special Week (Original)", 0, "2600m Turf (R)", "S2-1", "Special Week", "Original", 5]
    ],
    tournamentWinners: {
        "S2-1": ["Raccoon", "MetaHayato", "Spyder"]
    },
    tournamentBans: {
        "S2-1": [
            "Mejiro McQueen (Original)",
            "Seiun Sky (Original)",
            "Gold Ship (Original)",
            "Manhattan Cafe (Original)",
            "Maruzensky (Summer)"
        ]
    },
    tournamentRaceResults: {
        "S2-1": {
            "Group A": [
                ["Kenesu", "HoriYon", "Bunsen", "KN", "Pines", "Mixsy", "Jedmumu", "Draguin", "Nymaera"],
                ["Bunsen", "Kenesu", "Nymaera", "HoriYon", "Draguin", "Mixsy", "Pines", "KN", "Jedmumu"],
                ["Jedmumu", "Bunsen", "Draguin", "KN", "Kenesu", "Mixsy", "HoriYon", "Pines", "Nymaera"],
                ["Mixsy", "Bunsen", "Jedmumu", "Draguin", "HoriYon", "Kenesu", "KN", "Nymaera", "Pines"],
                ["Draguin", "Jedmumu", "Bunsen", "HoriYon", "KN", "Pines", "Nymaera", "Mixsy", "Kenesu"]
            ],
            "Group B": [
                ["Eva", "Spyder", "Raccoon", "FuHua", "Boop", "Synocra", "Teki", "MetaHayato", "Roidee"],
                ["FuHua", "Spyder", "Eva", "Raccoon", "Roidee", "Boop", "MetaHayato", "Synocra", "Teki"],
                ["FuHua", "Spyder", "Teki", "Boop", "Eva", "Roidee", "MetaHayato", "Raccoon", "Synocra"],
                ["Raccoon", "MetaHayato", "Teki", "Roidee", "Spyder", "Eva", "Boop", "FuHua", "Synocra"],
                ["Eva", "Synocra", "FuHua", "MetaHayato", "Roidee", "Spyder", "Teki", "Boop", "Raccoon"]
            ],
            "Finals": [
                ["MetaHayato", "Spyder", "Bunsen", "Draguin", "Eva", "Raccoon", "Boop", "Pines", "FuHua"],
                ["Spyder", "Bunsen", "Eva", "Raccoon", "MetaHayato", "Boop", "FuHua", "Draguin", "Pines"],
                ["Raccoon", "Spyder", "MetaHayato", "Bunsen", "Pines", "Boop", "FuHua", "Draguin", "Eva"],
                ["Eva", "FuHua", "Raccoon", "Bunsen", "Pines", "Draguin", "Spyder", "MetaHayato", "Boop"],
                ["Raccoon", "MetaHayato", "FuHua", "Bunsen", "Draguin", "Pines", "Boop", "Spyder", "Eva"]
            ]
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = { S2_DATA };
}