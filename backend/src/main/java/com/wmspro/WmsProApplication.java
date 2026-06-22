package com.wmspro;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WmsProApplication {
    public static void main(String[] args) {
        SpringApplication.run(WmsProApplication.class, args);
    }
}
