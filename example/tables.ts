import { Types } from "../src/main";

export class Tables {
    static getMilimetersTable(): Types.QuoteTable {
        return {
            stations: [
                {
                    position: 0,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0 },
                        { height: 500, halfBreadthPort: 1200 },
                        { height: 1000, halfBreadthPort: 1500 }
                    ]
                },
                {
                    position: 5000,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0 },
                        { height: 500, halfBreadthPort: 2000 },
                        { height: 1000, halfBreadthPort: 2500 }
                    ]
                },
                {
                    position: 10000,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0 },
                        { height: 500, halfBreadthPort: 1200 },
                        { height: 1000, halfBreadthPort: 1500 }
                    ]
                }
            ],
            metadata: {
                weight: 2000,
                symmetry: "symmetric",
                units: "mm",
                hasKeel: true,
                hasChine: false,
                thickness: 0.1 // Added to match new format
            }
        }
    }
    static getFtTable(): Types.QuoteTable {
        return {
            stations: [
                {
                    position: 0,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0 },
                        { height: 1.0, halfBreadthPort: 3.5 },
                        { height: 2.0, halfBreadthPort: 4.2 }
                    ]
                },
                {
                    position: 15,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0 },
                        { height: 1.0, halfBreadthPort: 6.5 },
                        { height: 2.0, halfBreadthPort: 7.0 }
                    ]
                },
                {
                    position: 30,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0 },
                        { height: 1.0, halfBreadthPort: 3.0 },
                        { height: 2.0, halfBreadthPort: 4.0 }
                    ]
                }
            ],
            metadata: {
                symmetry: "asymmetric",
                units: "ft",
                hasKeel: true,
                hasChine: true,
                weight: 3000,
                thickness: 0.1 // Added to match new format
            }
        }
    }
    static getMetersTable(): Types.QuoteTable {
        return {
            stations: [
                {
                    position: 0,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0.00 },
                        { height: 0.15, halfBreadthPort: 0.00 },
                        { height: 0.30, halfBreadthPort: 0.00 },
                        { height: 0.45, halfBreadthPort: 0.00 },
                        { height: 0.60, halfBreadthPort: 0.00 },
                        { height: 0.75, halfBreadthPort: 0.00 },
                        { height: 0.90, halfBreadthPort: 0.00 }
                    ]
                },
                {
                    position: 1.0,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0.00 },
                        { height: 0.15, halfBreadthPort: 0.25 },
                        { height: 0.30, halfBreadthPort: 0.45 },
                        { height: 0.45, halfBreadthPort: 0.65 },
                        { height: 0.60, halfBreadthPort: 0.80 },
                        { height: 0.75, halfBreadthPort: 0.85 },
                        { height: 0.90, halfBreadthPort: 0.75 }
                    ]
                },
                {
                    position: 2.0,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0.00 },
                        { height: 0.15, halfBreadthPort: 0.50 },
                        { height: 0.30, halfBreadthPort: 0.75 },
                        { height: 0.45, halfBreadthPort: 0.95 },
                        { height: 0.60, halfBreadthPort: 1.10 },
                        { height: 0.75, halfBreadthPort: 1.15 },
                        { height: 0.90, halfBreadthPort: 1.05 }
                    ]
                },
                {
                    position: 3.0,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0.00 },
                        { height: 0.15, halfBreadthPort: 0.65 },
                        { height: 0.30, halfBreadthPort: 0.90 },
                        { height: 0.45, halfBreadthPort: 1.10 },
                        { height: 0.60, halfBreadthPort: 1.25 },
                        { height: 0.75, halfBreadthPort: 1.30 },
                        { height: 0.90, halfBreadthPort: 1.20 }
                    ]
                },
                {
                    position: 4.0,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0.00 },
                        { height: 0.15, halfBreadthPort: 0.60 },
                        { height: 0.30, halfBreadthPort: 0.85 },
                        { height: 0.45, halfBreadthPort: 1.05 },
                        { height: 0.60, halfBreadthPort: 1.20 },
                        { height: 0.75, halfBreadthPort: 1.25 },
                        { height: 0.90, halfBreadthPort: 1.15 }
                    ]
                },
                {
                    position: 5.0,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0.00 },
                        { height: 0.15, halfBreadthPort: 0.40 },
                        { height: 0.30, halfBreadthPort: 0.60 },
                        { height: 0.45, halfBreadthPort: 0.75 },
                        { height: 0.60, halfBreadthPort: 0.85 },
                        { height: 0.75, halfBreadthPort: 0.90 },
                        { height: 0.90, halfBreadthPort: 0.80 }
                    ]
                },
                {
                    position: 6.0,
                    waterlines: [
                        { height: 0.0, halfBreadthPort: 0.30 },
                        { height: 0.15, halfBreadthPort: 0.35 },
                        { height: 0.30, halfBreadthPort: 0.40 },
                        { height: 0.45, halfBreadthPort: 0.45 },
                        { height: 0.60, halfBreadthPort: 0.50 },
                        { height: 0.75, halfBreadthPort: 0.55 },
                        { height: 0.90, halfBreadthPort: 0.50 }
                    ]
                }
            ],
            metadata: {
                weight: 1500,
                units: 'm',
                symmetry: 'symmetric',
                hasKeel: true,
                hasChine: true,
                thickness: 0.1
            }
        }
    }
}