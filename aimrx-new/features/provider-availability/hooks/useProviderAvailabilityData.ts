"use client";

import { useState, useEffect } from "react";
import { createClient } from "@core/supabase/client";
import { WeeklySchedule, AvailabilityException, InsertWeeklySchedule, InsertAvailabilityException } from "../types";

export function useProviderAvailabilityData(providerId: string) {
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      // Don't fetch if no provider ID
      if (!providerId) {
        setWeeklySchedule([]);
        setExceptions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        
        // Fetch weekly schedule
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('provider_availability')
          .select('*')
          .eq('provider_id', providerId);
          
        if (scheduleError) throw scheduleError;
        
        // Fetch exceptions
        const { data: exceptionData, error: exceptionError } = await supabase
          .from('provider_availability_exceptions')
          .select('*')
          .eq('provider_id', providerId);
          
        if (exceptionError) throw exceptionError;
        
        setWeeklySchedule(scheduleData || []);
        setExceptions(exceptionData || []);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error fetching availability data';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [providerId]);

  // Save weekly schedule
  const saveWeeklySchedule = async (schedule: InsertWeeklySchedule) => {
    if (!providerId) {
      throw new Error('Provider ID is required');
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_availability')
        .insert({
          ...schedule,
          provider_id: providerId
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setWeeklySchedule(prev => [...prev, data]);
      return data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error saving schedule';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Save exception
  const saveException = async (exception: InsertAvailabilityException) => {
    if (!providerId) {
      throw new Error('Provider ID is required');
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_availability_exceptions')
        .insert({
          ...exception,
          provider_id: providerId
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setExceptions(prev => [...prev, data]);
      return data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error saving exception';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Delete weekly schedule
  const deleteWeeklySchedule = async (id: string) => {
    if (!providerId) {
      throw new Error('Provider ID is required');
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('provider_availability')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setWeeklySchedule(prev => prev.filter(item => item.id !== id));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error deleting schedule';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Delete exception
  const deleteException = async (id: string) => {
    if (!providerId) {
      throw new Error('Provider ID is required');
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('provider_availability_exceptions')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setExceptions(prev => prev.filter(item => item.id !== id));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error deleting exception';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  return {
    weeklySchedule,
    exceptions,
    isLoading,
    error,
    saveWeeklySchedule,
    saveException,
    deleteWeeklySchedule,
    deleteException
  };
} 