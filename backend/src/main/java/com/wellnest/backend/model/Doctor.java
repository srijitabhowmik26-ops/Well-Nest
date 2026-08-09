package com.wellnest.backend.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class Doctor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String spec;
    private String dept;
    private int exp;
    private String location;
    private double rating;
    private String avail;

    public Doctor() {
    }

    public Doctor(String name, String spec, String dept, int exp,
                  String location, double rating, String avail) {
        this.name = name;
        this.spec = spec;
        this.dept = dept;
        this.exp = exp;
        this.location = location;
        this.rating = rating;
        this.avail = avail;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getSpec() {
        return spec;
    }

    public String getDept() {
        return dept;
    }

    public int getExp() {
        return exp;
    }

    public String getLocation() {
        return location;
    }

    public double getRating() {
        return rating;
    }

    public String getAvail() {
        return avail;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setSpec(String spec) {
        this.spec = spec;
    }

    public void setDept(String dept) {
        this.dept = dept;
    }

    public void setExp(int exp) {
        this.exp = exp;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public void setRating(double rating) {
        this.rating = rating;
    }

    public void setAvail(String avail) {
        this.avail = avail;
    }
}