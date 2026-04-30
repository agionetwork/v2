"use client"

import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Pencil } from "lucide-react"
import React from "react"

interface EditProfileModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  displayName: string
  setDisplayName: (name: string) => void
  nickname: string
  setNickname: (nickname: string) => void
  bio: string
  setBio: (bio: string) => void
  profileImage: string
  isUploading: boolean
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handlePhotoClick: () => void
  handleSaveProfile: () => void
  handleDiscardChanges: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

export function EditProfileModal({
  isOpen,
  onOpenChange,
  displayName,
  setDisplayName,
  nickname,
  setNickname,
  bio,
  setBio,
  profileImage,
  isUploading,
  handleFileChange,
  handlePhotoClick,
  handleSaveProfile,
  handleDiscardChanges,
  fileInputRef
}: EditProfileModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="relative">
              <Avatar className="h-24 w-24 cursor-pointer" onClick={handlePhotoClick}>
                <AvatarImage 
                  src={profileImage} 
                  alt={displayName || "Profile"} 
                  className={isUploading ? "opacity-50" : ""}
                />
                <AvatarFallback>
                  {displayName ? displayName.slice(0, 2).toUpperCase() : "?"}
                </AvatarFallback>
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                )}
              </Avatar>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <Button 
                variant="outline" 
                size="icon" 
                className="absolute bottom-0 right-0 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                onClick={handlePhotoClick}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Click to change photo</p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name" 
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input 
              id="username" 
              value={nickname} 
              onChange={(e) => setNickname(e.target.value)}
              placeholder="@username" 
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea 
              id="bio" 
              value={bio} 
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself" 
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleDiscardChanges}>
            Cancel
          </Button>
          <Button onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-700 text-white">
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 