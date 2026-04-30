"use client"

import { Button, type ButtonProps } from "../ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Badge, type BadgeProps } from "../ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { CheckCircle, Shield, Star, Trophy, Users, X, Award, Heart, Share2, Gift, Pencil } from "lucide-react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { useState, useEffect } from "react"
import { Textarea } from "../ui/textarea"
import React from "react"
import { ReputationBadge } from "../ui/badge-reputation"
import { EditProfileModal } from "./edit-profile-modal"

export default function ProfileDashboard() {
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("badges")
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [displayName, setDisplayName] = useState<string>("")
  const [nickname, setNickname] = useState<string>("")
  const [bio, setBio] = useState<string>("")
  const [profileImage, setProfileImage] = useState<string>("/placeholder.svg")
  const [isUploading, setIsUploading] = useState(false)
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [walletProvider, setWalletProvider] = useState<string>("")
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  
  // Check if there's a connected wallet via localStorage and load saved profile data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Wallet connection info
      const storedWalletAddress = localStorage.getItem('walletAddress')
      const storedWalletProvider = localStorage.getItem('walletProvider')
      
      if (storedWalletAddress) {
        setWalletConnected(true)
        setWalletAddress(storedWalletAddress)
      }
      
      if (storedWalletProvider) {
        setWalletProvider(storedWalletProvider)
      }

      // Load previously saved profile data if available
      const savedDisplayName = localStorage.getItem('userDisplayName')
      const savedNickname = localStorage.getItem('userNickname')
      const savedBio = localStorage.getItem('userBio')
      const savedProfileImage = localStorage.getItem('userProfileImage')

      if (savedDisplayName) setDisplayName(savedDisplayName)
      if (savedNickname) setNickname(savedNickname)
      if (savedBio) setBio(savedBio)
      if (savedProfileImage) setProfileImage(savedProfileImage)
    }
  }, [])

  const handleSaveProfile = () => {
    // Save profile changes to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('userDisplayName', displayName)
      localStorage.setItem('userNickname', nickname)
      localStorage.setItem('userBio', bio)
      localStorage.setItem('userProfileImage', profileImage)
    }
    
    setIsEditModalOpen(false)
  }

  const handleDiscardChanges = () => {
    // Restore original values
    setDisplayName(localStorage.getItem('userDisplayName') || "")
    setNickname(localStorage.getItem('userNickname') || "")
    setBio(localStorage.getItem('userBio') || "")
    setProfileImage(localStorage.getItem('userProfileImage') || "/placeholder.svg")
    setIsEditModalOpen(false)
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        setIsUploading(true)
        const reader = new FileReader()
        reader.onloadend = () => {
          setProfileImage(reader.result as string)
          setIsUploading(false)
        }
        reader.readAsDataURL(file)
      } catch (error) {
        console.error('Error loading image:', error)
        setIsUploading(false)
      }
    }
  }

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  // Check if user is authenticated by wallet connection
  const isAuthenticated = walletConnected

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-lg text-muted-foreground">Please connect your wallet to view your profile</p>
      </div>
    )
  }
  
  // Format wallet address for display
  const formatWalletAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }
  
  // Determine user display name - priority to edited displayName, then wallet
  const getUserDisplayName = () => {
    if (displayName) return displayName;
    if (walletProvider) {
      const providerName = walletProvider.charAt(0).toUpperCase() + walletProvider.slice(1);
      return `${providerName} User`;
    }
    return "Anonymous User";
  }
  
  // Determine nickname for display - priority to edited nickname, then wallet address
  const getUserNickname = () => {
    if (nickname) {
      // Ensure nickname has @ prefix
      return nickname.startsWith('@') ? nickname : `@${nickname}`;
    }
    if (walletAddress) return formatWalletAddress(walletAddress);
    return "@user";
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Side Menu - Profile */}
      <div className="w-full md:w-64">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profileImage} alt={getUserDisplayName()} />
                <AvatarFallback>{getUserDisplayName().slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{getUserDisplayName()}</h2>
                <p className="text-xs text-muted-foreground">{getUserNickname()}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1 rounded-lg"
                onClick={() => setIsEditModalOpen(true)}
              >
                Edit Profile
              </Button>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Reputation Score</span>
                <ReputationBadge score={85} />
              </div>
              <Progress value={85} className="h-2" />
              
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center">
                  <div className="text-2xl font-bold">47</div>
                  <div className="text-xs text-muted-foreground">Total Transactions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">12</div>
                  <div className="text-xs text-muted-foreground">Loans Repaid</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">0%</div>
                  <div className="text-xs text-muted-foreground">Default Rate</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <Card>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="pb-2">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="badges" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Award className="h-4 w-4" />
                  Badges
                </TabsTrigger>
                <TabsTrigger value="reputation" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Star className="h-4 w-4" />
                  Reputation
                </TabsTrigger>
                <TabsTrigger value="social" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Users className="h-4 w-4" />
                  Social
                </TabsTrigger>
                <TabsTrigger value="referral" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Gift className="h-4 w-4" />
                  Referral
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-6">
              <TabsContent value="badges" className="mt-0">
                <div className="grid gap-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-500" />
                        <CardTitle>Security Expert</CardTitle>
                      </div>
                      <CardDescription>You are a security expert on the platform</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="default" className="bg-blue-500">Granted</Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-blue-500" />
                        <CardTitle>Trusted Lender</CardTitle>
                      </div>
                      <CardDescription>You are a trusted lender on the platform</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="default" className="bg-blue-500">Granted</Badge>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="reputation" className="mt-0">
                <div className="space-y-6">
                  <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                      <div className="absolute inset-0 rounded-full bg-gray-200 dark:bg-gray-800"></div>
                      <Progress 
                        value={85} 
                        className={`h-32 w-32 rounded-full ${
                          850 >= 800 ? "bg-green-500" : 
                          850 >= 500 ? "bg-yellow-500" : 
                          850 >= 200 ? "bg-orange-500" : 
                          "bg-red-500"
                        }`} 
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-3xl font-bold">850</div>
                          <div className="text-xs text-muted-foreground">/1000</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Payment History</span>
                        </div>
                        <span className="text-sm text-muted-foreground">95%</span>
                      </div>
                      <Progress value={95} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Network Quality</span>
                        </div>
                        <span className="text-sm text-muted-foreground">80%</span>
                      </div>
                      <Progress value={80} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Trophy className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium">Activity Level</span>
                        </div>
                        <span className="text-sm text-muted-foreground">75%</span>
                      </div>
                      <Progress value={75} className="h-2" />
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="social" className="mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="/placeholder.svg" alt="User" />
                      <AvatarFallback>AB</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">Alice Brown</p>
                      <p className="text-xs text-muted-foreground">5 mutual transactions</p>
                    </div>
                    <Badge className="bg-blue-600 text-white text-xs ml-auto">Connected</Badge>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="/placeholder.svg" alt="User" />
                      <AvatarFallback>MS</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">Mike Smith</p>
                      <p className="text-xs text-muted-foreground">3 mutual transactions</p>
                    </div>
                    <Badge className="bg-blue-600 text-white text-xs ml-auto">Connected</Badge>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="/placeholder.svg" alt="User" />
                      <AvatarFallback>JW</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">Jane Wilson</p>
                      <p className="text-xs text-muted-foreground">2 mutual transactions</p>
                    </div>
                    <Button size="sm" variant="outline" className="ml-auto h-7 text-xs bg-blue-600 text-white hover:bg-blue-700">
                      Connect
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="referral" className="mt-0">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">12</p>
                      <p className="text-sm text-muted-foreground">Total Referrals</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">5</p>
                      <p className="text-sm text-muted-foreground">Active Users</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">$120</p>
                      <p className="text-sm text-muted-foreground">Earned</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="referral-link">Your Referral Link</Label>
                    <div className="flex gap-2">
                      <Input id="referral-link" value="https://agionetwork.com/ref/user123" readOnly />
                      <Button variant="outline" className="bg-blue-600 text-white hover:bg-blue-700">
                        Copy
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Share Your Link</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1">
                        <Share2 className="mr-2 h-4 w-4" />
                        Twitter
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <Share2 className="mr-2 h-4 w-4" />
                        Telegram
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* Profile Edit Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        displayName={displayName}
        setDisplayName={setDisplayName}
        nickname={nickname}
        setNickname={setNickname}
        bio={bio}
        setBio={setBio}
        profileImage={profileImage}
        isUploading={isUploading}
        handleFileChange={handleFileChange}
        handlePhotoClick={handlePhotoClick}
        handleSaveProfile={handleSaveProfile}
        handleDiscardChanges={handleDiscardChanges}
        fileInputRef={fileInputRef}
      />
    </div>
  )
} 