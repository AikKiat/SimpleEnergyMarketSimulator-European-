package com.example.demo.ingestion.carbon;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

// {
//   "data":[
//   {
//     "from": "2018-01-20T12:00Z",
//     "to": "2018-01-20T12:30Z",
//     "generationmix": [
//       {
//         "fuel": "gas",
//         "perc": 43.6
//       },
//       {
//         "fuel": "coal",
//         "perc": 0.7
//       },
//       {
//         "fuel": "biomass",
//         "perc": 4.2
//       },
//       {
//         "fuel": "nuclear",
//         "perc": 17.6
//       },
//       {
//         "fuel": "hydro",
//         "perc": 1.1
//       },
//       {
//         "fuel": "imports",
//         "perc": 6.5
//       },
//       {
//         "fuel": "other",
//         "perc": 0.3
//       },
//       {
//         "fuel": "wind",
//         "perc": 6.8
//       },
//       {
//         "fuel": "solar",
//         "perc": 18.1
//       }
//     ]
//   }]
// }


public record GenerationMix(@NotNull @Valid Data data) implements CarbonIntensityApi {
    public record Entry(
        @NotBlank String fuel,
        @DecimalMin("0.0") @DecimalMax("100.0") double perc) {
    }

    public record Data(
        @NotBlank String from,
        @NotBlank String to,
        @NotEmpty List<@Valid Entry> generationmix) {
    }
}