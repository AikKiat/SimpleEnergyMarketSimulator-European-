package com.example.demo.market;

/** The access requirement for an external market-data source. */
public enum FeedAccess {
    FREE_NO_KEY("Free API, no registered key required"),
    FREE_API_KEY_REQUIRED("Free API, registered key is required"),
    PAID("A paid API endpoint. Need to pay and register to use");


    public final String label;


    public String getLabel(){
        return this.label;
    }

    private FeedAccess(String label) {
        this.label = label;
    }
}