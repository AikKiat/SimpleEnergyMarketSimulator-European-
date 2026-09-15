package com.example.demo.ingestion.carbon;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/** Maps the JSON returned by the Carbon Intensity API.
        Jackson alone will accept anything, so we need Jakarta Bean validation, from SpringBoot Starter Validation;
        Domain contract for CarbonIntensityResponse. External API response result sanitisation

        Example:
        {
        	"data":[
				{
					"from": "2018-01-20T12:00Z",
					"to": "2018-01-20T12:30Z",
					"intensity": {
						"forecast": 266,
						"actual": 263,
						"index": "moderate"
					}
				}
			]
		}
*/


//Intensity, nested inside like the expected schema
public record Intensity(@NotEmpty List<@Valid IntensityData> data) implements CarbonIntensityApi {

	public record IntensityData(
		@NotBlank String from,
		@NotBlank String to,
		@NotNull @Valid Reading intensity) {
	}

	//The nested "intensity" object.
	public record Reading(Integer forecast, Integer actual, String index) {
	}
}
