package com.example.demo.ingestion;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

import com.example.demo.ingestion.carbon.GenerationMix;
import com.example.demo.ingestion.carbon.Intensity;
import com.example.demo.ingestion.domain_contract.FuelShare;
import com.example.demo.ingestion.domain_contract.MarketData;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

/**
 * The ingestion boundary: what the pipeline refuses to accept.
 *
 * <p>Two layers are under test. The wire DTO ({@link GenerationMix}, {@link Intensity})
 * is checked with Bean Validation, exactly as {@code CarbonIntensityClient}
 * does after deserialising. The domain records ({@link FuelShare},
 * {@link MarketData}) enforce their own invariants in compact constructors, so
 * an invalid instance cannot exist at all.
 *
 * <p>Deliberately no Spring context — these run in milliseconds without Kafka.
 */
class MarketDataContractTest {

    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    // FuelShare: compact constructor

    @Test
    void fuelShareAcceptsTheFullValidRange() {
        new FuelShare("gas", 0.0);
        new FuelShare("wind", 100.0);
        new FuelShare("solar", 38.4);
    }

    @Test
    void fuelShareRejectsOutOfRangeShare() {
        assertThrows(IllegalArgumentException.class, () -> new FuelShare("gas", 150.0));
        assertThrows(IllegalArgumentException.class, () -> new FuelShare("gas", -1.0));
        assertThrows(IllegalArgumentException.class, () -> new FuelShare("gas", Double.NaN));
    }

    @Test
    void fuelShareRejectsMissingFuel() {
        assertThrows(NullPointerException.class, () -> new FuelShare(null, 10.0));
        assertThrows(IllegalArgumentException.class, () -> new FuelShare("   ", 10.0));
    }

    // MarketData: compact constructor

    @Test
    void marketDataCopiesTheMixDefensively() {
        List<FuelShare> callerOwned = new ArrayList<>(List.of(new FuelShare("gas", 40.0)));
        MarketData data = new MarketData("2026-09-15T00:00Z", "2026-09-15T00:30Z", callerOwned, 120, "moderate");

        callerOwned.clear();
        assertEquals(1, data.mix().size(), "mutating the caller's list must not affect the event");
        assertThrows(UnsupportedOperationException.class, () -> data.mix().add(new FuelShare("coal", 1.0)));
    }

    @Test
    void marketDataRejectsNegativeIntensity() {
        assertThrows(IllegalArgumentException.class,
                () -> new MarketData("2026-09-15T00:00Z", "2026-09-15T00:30Z", List.of(), -5, "low"));
    }

    @Test
    void marketDataAllowsUnknownIntensity() {
        // The intensity call is best-effort; the mix is still a valid event without it.
        MarketData data = new MarketData("2026-09-15T00:00Z", "2026-09-15T00:30Z", List.of(), null, null);
        assertNull(data.carbonIntensityGramsPerKwh());
    }

    @Test
    void marketDataRejectsBlankSettlementWindow() {
        assertThrows(IllegalArgumentException.class,
                () -> new MarketData("", "2026-09-15T00:30Z", List.of(), null, null));
    }

    // GenerationMix / Intensity: Bean Validation on the wire DTO

    @Test
    void validWirePayloadPasses() {
        GenerationMix ok = new GenerationMix(new GenerationMix.Data(
                "2026-09-15T00:00Z", "2026-09-15T00:30Z",
                List.of(new GenerationMix.Entry("gas", 38.4),
                        new GenerationMix.Entry("wind", 61.6))));

        assertTrue(VALIDATOR.validate(ok).isEmpty());
    }

    @Test
    void wirePayloadWithOutOfRangeShareIsRejectedAndNamesTheField() {
        GenerationMix bad = new GenerationMix(new GenerationMix.Data(
                "2026-09-15T00:00Z", "2026-09-15T00:30Z",
                List.of(new GenerationMix.Entry("gas", 150.0))));

        Set<ConstraintViolation<GenerationMix>> violations = VALIDATOR.validate(bad);

        assertEquals(1, violations.size());
        assertEquals("data.generationmix[0].perc", violations.iterator().next().getPropertyPath().toString());
    }

    @Test
    void wirePayloadWithEmptyMixIsRejected() {
        GenerationMix bad = new GenerationMix(new GenerationMix.Data(
                "2026-09-15T00:00Z", "2026-09-15T00:30Z", List.of()));

        assertFalse(VALIDATOR.validate(bad).isEmpty());
    }

    @Test
    void wirePayloadWithMissingDataObjectIsRejected() {
        assertFalse(VALIDATOR.validate(new GenerationMix(null)).isEmpty());
    }

    @Test
    void wirePayloadWithBlankFuelIsRejected() {
        GenerationMix bad = new GenerationMix(new GenerationMix.Data(
                "2026-09-15T00:00Z", "2026-09-15T00:30Z",
                List.of(new GenerationMix.Entry("", 50.0))));

        assertFalse(VALIDATOR.validate(bad).isEmpty());
    }
}
